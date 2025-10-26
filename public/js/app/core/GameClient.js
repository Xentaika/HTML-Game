import * as THREE from 'three';
import { socket } from '../network/socket.js';
import { HUD } from '../ui/HUD.js';
import { InputManager } from './InputManager.js';
import { LocalPlayer } from '../entities/LocalPlayer.js';
import { RemotePlayerManager } from '../entities/RemotePlayerManager.js';
import { WorldBuilder } from '../scene/WorldBuilder.js';
import { ArenaLayout } from '/shared/arenaLayout.js';
import { WeaponDefinitions, WeaponShopOrder } from '../data/weapons.js';

export class GameClient {
  constructor() {
    this.canvas = document.getElementById('world');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 200);
    this.scene.add(this.camera);

    WorldBuilder.build(this.scene);

    this.hud = new HUD();
    this.hud.showPlayOverlay(true);

    this.remotePlayers = new RemotePlayerManager(this.scene);
    this.localPlayer = new LocalPlayer(this.camera, ArenaLayout);
    this.localPlayer.reset(ArenaLayout);

    this.pointerLocked = false;
    this.pointer = {
      yaw: 0,
      pitch: 0
    };

    this.serverTickRate = 60;
    this.fixedDelta = 1 / this.serverTickRate;
    this.accumulator = 0;
    this.lastFrame = performance.now();

    this.playerId = null;
    this.weaponOrder = WeaponShopOrder;

    this.crosshairKick = 0;
    this.crosshairBase = 6;
    this.shouldRestorePointer = false;

    this.inputManager = new InputManager({
      onShoot: (active) => this.handleShootInput(active),
      onReload: () => this.requestReload(),
      onToggleBuy: () => this.toggleBuyMenu(),
      onNextWeapon: () => this.cycleWeapon(1),
      onPrevWeapon: () => this.cycleWeapon(-1),
      onSelectWeapon: (slot) => this.selectWeaponBySlot(slot)
    });

    this.hud.onPlayRequest(() => this.connect());
    this.hud.populateBuyMenu(this.weaponOrder, (weaponId) => this.buyWeapon(weaponId));
    this.hud.setCrosshairSpread(this.crosshairBase);
    this.hud.onBuyClose(() => {
      if (!this.buyMenuOpen) {
        return;
      }
      this.buyMenuOpen = false;
      this.inputManager.setSuppressed(false);
      if (this.shouldRestorePointer) {
        this.canvas.requestPointerLock();
      }
      this.shouldRestorePointer = false;
    });

    this.buyMenuOpen = false;
    this.pingInterval = null;

    this.setupPointerLock();
    this.setupSocketEvents();

    window.addEventListener('resize', () => this.handleResize());
    this.handleResize();

    this.animate();
  }

  setupPointerLock() {
    this.canvas.addEventListener('click', () => {
      if (!this.pointerLocked && !this.buyMenuOpen) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (!this.pointerLocked) {
        this.shouldRestorePointer = false;
      }
    });

    document.addEventListener('mousemove', (event) => {
      if (!this.pointerLocked) {
        return;
      }
      const sensitivity = 0.0022;
      this.pointer.yaw -= event.movementX * sensitivity;
      this.pointer.pitch -= event.movementY * sensitivity;
      this.pointer.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pointer.pitch));
    });
  }

  setupSocketEvents() {
    socket.on('connect', () => {
      this.hud.setConnectionStatus('Подключено');
      this.startPing();
    });

    socket.on('disconnect', () => {
      this.hud.setConnectionStatus('Отключено от сервера', true);
      this.stopPing();
      this.playerId = null;
    });

    socket.on('init', ({ id, snapshot, config }) => {
      this.playerId = id;
      if (config?.tickRate) {
        this.serverTickRate = config.tickRate;
        this.fixedDelta = 1 / this.serverTickRate;
      }
      if (config?.buy?.order) {
        this.weaponOrder = config.buy.order;
        this.hud.populateBuyMenu(this.weaponOrder, (weaponId) => this.buyWeapon(weaponId));
      }
      if (snapshot) {
        this.handleSnapshot(snapshot);
      }
      this.hud.showPlayOverlay(false);
      this.hud.setConnectionStatus('В игре');
    });

    socket.on('snapshot', (snapshot) => this.handleSnapshot(snapshot));

    socket.on('playerHit', (event) => {
      if (event.targetId === this.playerId) {
        this.hud.addKillFeed(`По вам попал ${event.shooterId.slice(0, 6)} (${event.damage})`, event.headshot ? 'critical' : 'damage');
        this.hud.showHitMarker(false);
      } else if (event.shooterId === this.playerId) {
        this.hud.addKillFeed(`Попадание по ${event.targetId.slice(0, 6)}`, event.headshot ? 'critical' : 'default');
        this.hud.showHitMarker(event.headshot);
        this.hud.pulseCrosshair(event.headshot ? 'headshot' : 'hit');
      }
    });

    socket.on('playerEliminated', ({ targetId, killerId }) => {
      if (killerId === this.playerId) {
        this.hud.addKillFeed(`Вы устранили ${targetId.slice(0, 6)}`, 'kill');
      } else if (targetId === this.playerId) {
        this.hud.addKillFeed(`Вас устранил ${killerId.slice(0, 6)}`, 'death');
      } else {
        this.hud.addKillFeed(`${killerId.slice(0, 6)} устранил ${targetId.slice(0, 6)}`);
      }
    });

    socket.on('playerLeft', ({ id }) => {
      this.remotePlayers.remove(id);
    });

    socket.on('shotResult', (result) => {
      if (result.shooterId === this.playerId && result.hit) {
        this.hud.pulseCrosshair(result.headshot ? 'headshot' : 'hit');
      }
    });

    socket.on('reloadAcknowledged', () => {
      this.localPlayer.setReloading(true);
    });

    socket.on('weaponSwitched', ({ weaponId }) => {
      if (this.localPlayer.state.weapons.has(weaponId)) {
        this.localPlayer.state.activeWeapon = weaponId;
        this.localPlayer.viewModel.equip(weaponId);
      }
    });
  }

  startPing() {
    this.stopPing();
    const sendPing = () => {
      const start = performance.now();
      socket.emit('clientPing', {}, (response) => {
        const latency = performance.now() - start;
        this.hud.updatePing(latency);
      });
    };
    sendPing();
    this.pingInterval = setInterval(sendPing, 2000);
  }

  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.hud.updatePing(null);
  }

  connect() {
    if (!socket.connected) {
      socket.connect();
      this.hud.setConnectionStatus('Подключение...');
    }
  }

  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  handleSnapshot(snapshot) {
    if (!snapshot?.players) {
      return;
    }
    const localInfo = snapshot.players.find((player) => player.id === this.playerId);
    if (localInfo) {
      if (!this.pointerLocked) {
        this.pointer.yaw = localInfo.yaw;
        this.pointer.pitch = localInfo.pitch;
      }
      this.localPlayer.reconcile(localInfo, this.fixedDelta);
      const activeState = this.localPlayer.getActiveWeaponState();
      if (activeState) {
        this.hud.updateAmmo(activeState);
      }
      this.hud.updateHealth(localInfo.health);
      this.hud.updateMoney(localInfo.money);
      this.hud.updateScore(localInfo.score);
      this.hud.setBuyPrompt(localInfo.buyZone);
      this.localPlayer.setReloading(activeState?.reloading ?? false);
      if (!localInfo.buyZone && this.buyMenuOpen) {
        this.buyMenuOpen = false;
        this.hud.toggleBuyMenu(false);
        this.inputManager.setSuppressed(false);
        this.shouldRestorePointer = false;
      }
    }
    this.remotePlayers.applySnapshot(snapshot, this.playerId);
  }

  handleShootInput(active) {
    if (!active) {
      return;
    }
    if (this.buyMenuOpen) {
      return;
    }
    if (!socket.connected) {
      return;
    }
    const now = performance.now() / 1000;
    if (!this.localPlayer.canShoot(now)) {
      return;
    }
    this.localPlayer.applyShotFeedback({ hit: false });
    const state = this.localPlayer.getActiveWeaponState();
    if (state) {
      this.hud.updateAmmo(state);
    }
    socket.emit('shoot');
    this.hud.pulseCrosshair('fire');
    this.crosshairKick = Math.min(18, this.crosshairKick + 6);
  }

  requestReload() {
    if (!socket.connected) {
      return;
    }
    socket.emit('reload');
    this.localPlayer.setReloading(true);
  }

  toggleBuyMenu() {
    if (!this.localPlayer.state.buyZone) {
      return;
    }
    this.buyMenuOpen = !this.buyMenuOpen;
    this.hud.toggleBuyMenu(this.buyMenuOpen);
    this.inputManager.setSuppressed(this.buyMenuOpen);
    if (this.buyMenuOpen) {
      this.shouldRestorePointer = this.pointerLocked;
      if (document.pointerLockElement === this.canvas) {
        document.exitPointerLock();
      }
    } else {
      if (this.shouldRestorePointer) {
        this.canvas.requestPointerLock();
      }
      this.shouldRestorePointer = false;
    }
  }

  buyWeapon(weaponId) {
    if (!socket.connected) {
      return;
    }
    socket.emit('buyWeapon', weaponId, (result) => {
      if (!result?.success) {
        this.hud.addKillFeed('Покупка недоступна', 'warning');
      } else {
        this.hud.addKillFeed(`Приобретено: ${WeaponDefinitions[weaponId].name}`, 'info');
        const definition = WeaponDefinitions[weaponId];
        this.localPlayer.state.weapons.set(weaponId, {
          ammo: definition.magazineSize,
          reserve: definition.reserveAmmo,
          reloading: false,
          reloadEnd: 0
        });
        this.localPlayer.state.activeWeapon = weaponId;
        this.localPlayer.viewModel.equip(weaponId);
        this.hud.updateAmmo({ ammo: definition.magazineSize, reserve: definition.reserveAmmo });
        if (typeof result.money === 'number') {
          this.hud.updateMoney(result.money);
        }
      }
    });
  }

  cycleWeapon(direction) {
    const keys = Array.from(this.localPlayer.state.weapons.keys());
    if (keys.length === 0) {
      return;
    }
    const currentIndex = keys.indexOf(this.localPlayer.state.activeWeapon);
    const nextIndex = (currentIndex + direction + keys.length) % keys.length;
    const nextWeapon = keys[nextIndex];
    this.selectWeapon(nextWeapon);
  }

  selectWeaponBySlot(slot) {
    const index = slot - 1;
    const keys = Array.from(this.localPlayer.state.weapons.keys());
    if (keys[index]) {
      this.selectWeapon(keys[index]);
    }
  }

  selectWeapon(weaponId) {
    if (!this.localPlayer.state.weapons.has(weaponId)) {
      return;
    }
    if (socket.connected) {
      socket.emit('switchWeapon', weaponId);
    }
    this.localPlayer.state.activeWeapon = weaponId;
    this.localPlayer.viewModel.equip(weaponId);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const now = performance.now();
    const delta = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    this.accumulator += delta;
    const maxAccumulator = this.fixedDelta * 5;
    if (this.accumulator > maxAccumulator) {
      this.accumulator = maxAccumulator;
    }

    const step = this.fixedDelta;
    while (this.accumulator >= step) {
      const payload = this.inputManager.buildInputPayload(this.pointer);
      this.localPlayer.registerPendingInput(payload);
      this.localPlayer.simulate(payload, step);
      if (socket.connected && !this.buyMenuOpen) {
        socket.emit('input', payload);
      }
      this.accumulator -= step;
    }

    this.localPlayer.update(delta);
    this.remotePlayers.update(delta);
    this.crosshairKick = Math.max(0, this.crosshairKick - delta * 18);
    const speed = this.localPlayer.state.velocity.length();
    const weapon = WeaponDefinitions[this.localPlayer.state.activeWeapon];
    const weaponSpread = weapon ? weapon.spread * 2600 : 0;
    const movementSpread = Math.min(speed * 2.2, 14);
    const totalSpread = this.crosshairBase + movementSpread + weaponSpread + this.crosshairKick;
    this.hud.setCrosshairSpread(totalSpread);
    this.renderer.render(this.scene, this.camera);
  }
}
