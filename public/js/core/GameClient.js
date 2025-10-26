import * as THREE from 'three';
import { HUDOverlay } from './HUD.js';
import { socket } from './network.js';
import { LocalPlayer } from '../entities/LocalPlayer.js';
import { RemotePlayerManager } from '../entities/RemotePlayerManager.js';
import { InputController } from './InputController.js';
import { ArenaBuilder } from '../scenes/ArenaBuilder.js';
import { SmoothPointerLockControls } from './SmoothPointerLockControls.js';
import { FirstPersonRig } from '../entities/FirstPersonRig.js';
import { MOVEMENT_CONFIG } from '../config/movementConfig.js';

const INPUT_INTERVAL = 1 / 90;

export class GameClient {
  constructor() {
    this.canvas = document.getElementById('world');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1c18);

    this.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 400);
    this.controls = new SmoothPointerLockControls(this.camera, this.renderer.domElement, {
      pointerSpeed: 0.2,
      smoothingFactor: 0.08,
      maxRotationStep: 0.1
    });
    this.scene.add(this.controls.getObject());

    this.clock = new THREE.Clock();

    this.hud = new HUDOverlay();
    this.input = new InputController(this.controls, this.hud);
    this.player = new LocalPlayer(this.controls, MOVEMENT_CONFIG);
    this.remotePlayers = new RemotePlayerManager(this.scene);
    this.firstPersonRig = new FirstPersonRig(this.controls.getObject());

    this.weaponTemplates = {};
    this.arenaConfig = null;
    this.buyZones = [];
    this.colliders = [];

    this.networkStats = {
      ping: null,
      tickRate: null,
      targetTickRate: null,
      lastTick: null,
      lastTime: null
    };
    this.pingIntervalId = null;
    this.awaitingPing = false;
    this.pingTimeoutId = null;

    this.inputDirty = false;
    this.inputAccumulator = 0;
    this.buyMenuOpen = false;
    this.expectingPointerUnlock = false;

    this.input.onInput = () => {
      this.inputDirty = true;
    };
    this.input.onFire = () => this.handleFire();
    this.input.onReload = () => this.handleReload();
    this.input.onConnectRequest = () => this.connect();
    this.input.onToggleBuy = () => this.toggleBuyMenu();
    this.input.onSwitchWeapon = (slot) => this.requestWeaponSwitch(slot);
    this.hud.onBuyRequest = (weaponId) => this.buyWeapon(weaponId);
    this.hud.closeBuyMenuBtn?.addEventListener('click', () => this.toggleBuyMenu(false));

    this.controls.addEventListener('lock', () => {
      this.expectingPointerUnlock = false;
      if (!socket.connected) {
        this.connect();
      }
      this.hud.toggleStartPrompt(false);
      if (this.buyMenuOpen) {
        this.toggleBuyMenu(false);
      }
    });

    this.controls.addEventListener('unlock', () => {
      if (this.buyMenuOpen) {
        return;
      }
      if (this.expectingPointerUnlock) {
        this.expectingPointerUnlock = false;
        return;
      }
      this.hud.toggleStartPrompt(true);
    });

    this.loadInitialData();
    this.setupEvents();
    this.setupSocket();
    this.animate();
  }

  async loadInitialData() {
    try {
      const response = await fetch('/shared/arena.json');
      if (response.ok) {
        this.arenaConfig = await response.json();
        ArenaBuilder.build(this.scene, this.arenaConfig);
        this.buyZones = (this.arenaConfig.buyZones || []).map((zone) => ({
          center: { x: zone.center[0], y: zone.center[1], z: zone.center[2] },
          radius: zone.radius
        }));
        this.colliders = [...(this.arenaConfig.colliders || []), ...(this.arenaConfig.cover || [])].map((item) => {
          const half = { x: item.scale[0] / 2, y: item.scale[1] / 2, z: item.scale[2] / 2 };
          return {
            min: { x: item.position[0] - half.x, y: item.position[1] - half.y, z: item.position[2] - half.z },
            max: { x: item.position[0] + half.x, y: item.position[1] + half.y, z: item.position[2] + half.z }
          };
        });
        this.player.setColliders(this.colliders);
      }
    } catch (err) {
      console.error('Failed to load arena description', err);
    }
  }

  setupEvents() {
    window.addEventListener('resize', () => this.handleResize());
    this.handleResize();

    if (this.hud.startPrompt) {
      this.hud.startPrompt.addEventListener('click', () => {
        this.hud.toggleStartPrompt(false);
        this.connect();
        this.controls.lock();
      });
    }
  }

  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  connect() {
    if (socket.connected) {
      return;
    }
    this.hud.setConnectionStatus('Подключение…');
    socket.connect();
  }

  setupSocket() {
    socket.on('connect', () => {
      this.resetNetworkStats();
      this.startPingMonitor();
      this.hud.setConnectionStatus('Подключено', false);
    });

    socket.on('disconnect', () => {
      this.stopPingMonitor();
      this.resetNetworkStats();
      this.hud.setConnectionStatus('Отключено от сервера');
      this.hud.toggleStartPrompt(true);
    });

    socket.on('init', ({ id, snapshot, tickRate, weapons, buyZones }) => {
      this.player.id = id;
      if (Array.isArray(buyZones)) {
        this.buyZones = buyZones.map((zone) => ({
          center: { x: zone.center.x, y: zone.center.y, z: zone.center.z },
          radius: zone.radius
        }));
      }
      if (weapons) {
        this.weaponTemplates = weapons;
        this.player.setWeaponTemplates(this.weaponTemplates);
        this.remotePlayers.setWeaponTemplates(this.weaponTemplates);
        this.firstPersonRig.setWeaponTemplates(this.weaponTemplates);
        this.hud.setWeaponCatalog(this.weaponTemplates);
      }
      this.networkStats.targetTickRate = typeof tickRate === 'number' ? tickRate : null;
      this.resetNetworkStats({ preserveTarget: true });
      if (snapshot) {
        this.applySnapshot(snapshot);
        this.handleSnapshotTiming(snapshot);
      }
      this.hud.toggleStartPrompt(false);
      this.hud.setConnectionStatus('');
      this.hud.setConnectionStatus('', false);
    });

    socket.on('playerJoined', (info) => {
      if (!info || info.id === this.player.id) {
        return;
      }
      const remote = this.remotePlayers.ensure(info.id);
      remote.setSnapshot(info);
      this.hud.addFeedEntry(`Игрок ${info.id.slice(0, 6)} подключился`);
    });

    socket.on('playerLeft', ({ id }) => {
      this.remotePlayers.remove(id);
      this.hud.addFeedEntry(`Игрок ${id.slice(0, 6)} покинул арену`);
    });

    socket.on('stateSnapshot', (snapshot) => {
      if (!snapshot) {
        return;
      }
      this.applySnapshot(snapshot);
      this.handleSnapshotTiming(snapshot);
    });

    socket.on('playerHit', ({ shooterId, targetId, damage, headshot, remaining }) => {
      if (targetId === this.player.id) {
        this.player.health = remaining;
        if (remaining <= 0) {
          this.hud.addFeedEntry(
            `Вы были устранены ${shooterId.slice(0, 6)}${headshot ? ' (хедшот)' : ''}`,
            headshot
          );
        } else {
          this.hud.addFeedEntry(`Вас ранил ${shooterId.slice(0, 6)} (${damage})`, headshot);
        }
      } else {
        this.remotePlayers.highlightDamage(targetId, headshot);
      }

      if (shooterId === this.player.id) {
        this.hud.addFeedEntry(`Вы попали по ${targetId.slice(0, 6)}${headshot ? ' (хедшот)' : ''}`, headshot);
        this.hud.showHitMarker(headshot);
        this.hud.animateCrosshair(headshot ? 'headshot' : 'hit');
      }
      this.hud.updatePlayerStats(this.player);
    });

    socket.on('playerEliminated', ({ targetId, killerId, respawn, score }) => {
      if (targetId === this.player.id) {
        if (respawn) {
          this.player.position.set(respawn.x, respawn.y, respawn.z);
          this.controls.getObject().position.copy(this.player.position);
        }
        this.player.health = 100;
        this.player.inBuyZone = false;
        this.player.jumpArmed = false;
        this.hud.setReloadIndicator(false);
        this.firstPersonRig.setReloading(false);
        this.hud.updatePlayerStats(this.player);
      } else {
        this.remotePlayers.setRespawn(targetId, respawn);
      }

      if (killerId === this.player.id && typeof score === 'number') {
        this.player.score = score;
        this.hud.addFeedEntry(`Вы устранили ${targetId.slice(0, 6)}!`);
      } else if (targetId === this.player.id) {
        this.hud.addFeedEntry(`Игрок ${killerId.slice(0, 6)} вас устранил`);
      }
    });
  }

  applySnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.players)) {
      return;
    }
    const seenRemote = new Set();
    snapshot.players.forEach((info) => {
      if (!info || !info.id) {
        return;
      }
      if (info.id === this.player.id) {
        this.player.applySnapshot(info);
        this.player.setServerTick(snapshot.tick);
        const weapon = this.player.getWeapon();
        this.firstPersonRig.setWeapon(weapon?.id || null);
        this.firstPersonRig.setReloading(Boolean(weapon?.reloading));
        this.hud.setReloadIndicator(Boolean(weapon?.reloading));
      } else {
        this.remotePlayers.ensure(info.id).setSnapshot(info);
        seenRemote.add(info.id);
      }
    });
    this.remotePlayers.players.forEach((_, id) => {
      if (!seenRemote.has(id)) {
        this.remotePlayers.remove(id);
      }
    });
    this.hud.updatePlayerStats(this.player);
  }

  sendInput(delta) {
    if (!socket.connected || !this.player.id) {
      return;
    }
    this.inputAccumulator += delta;
    this.input.trackOrientationChanges();

    if (!this.inputDirty && this.inputAccumulator < INPUT_INTERVAL) {
      return;
    }

    const payload = this.input.buildInputPayload();
    socket.emit('input', payload);
    this.inputAccumulator = 0;
    this.inputDirty = false;
    if (payload.jump) {
      this.player.handleJumpAcknowledged();
    }
    this.input.acknowledgePayload(payload);
  }

  handleFire() {
    if (this.buyMenuOpen || !socket.connected || !this.player.id) {
      return;
    }
    const now = performance.now() / 1000;
    if (!this.player.canShoot(now)) {
      if (this.player.getWeapon()?.ammo === 0) {
        this.handleReload();
      }
      return;
    }
    if (this.player.shoot(now)) {
      this.hud.animateCrosshair('fire');
      this.firstPersonRig.triggerShot();
      this.hud.updatePlayerStats(this.player);
      const origin = this.controls.getObject().position.clone();
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
      socket.emit('shoot', {
        origin: { x: origin.x, y: origin.y, z: origin.z },
        direction: { x: direction.x, y: direction.y, z: direction.z }
      });
      this.inputDirty = true;
    }
  }

  handleReload() {
    if (this.buyMenuOpen || !socket.connected || !this.player.id) {
      return;
    }
    const now = performance.now() / 1000;
    if (this.player.startReload(now)) {
      socket.emit('reload');
      this.hud.setReloadIndicator(true);
      this.firstPersonRig.setReloading(true);
    }
  }

  updateWeaponState(now) {
    if (this.player.updateReload(now)) {
      this.hud.setReloadIndicator(false);
      this.firstPersonRig.setReloading(false);
      this.hud.updatePlayerStats(this.player);
    }
  }

  requestWeaponSwitch(slot) {
    if (!socket.connected || !this.player.id) {
      return;
    }
    if (this.player.equip(slot)) {
      const weapon = this.player.getWeapon();
      this.firstPersonRig.setWeapon(weapon?.id || null);
      this.hud.updatePlayerStats(this.player);
    }
    socket.emit('switchWeapon', slot);
  }

  buyWeapon(weaponId) {
    if (!socket.connected || !this.player.id || !weaponId) {
      return;
    }
    socket.emit('buyWeapon', weaponId, (result) => {
      if (result && result.success) {
        const template = this.weaponTemplates[weaponId];
        if (template) {
          const slot = template.slot === 'sniper' ? 'primary' : template.slot;
          const weapon = this.player.ensureWeapon(slot, weaponId);
          if (weapon) {
            this.player.equip(slot);
            this.firstPersonRig.setWeapon(weaponId);
            if (typeof template.price === 'number') {
              this.player.money = Math.max(0, this.player.money - template.price);
            }
            this.hud.updatePlayerStats(this.player);
          }
        }
        this.hud.addFeedEntry(`Покупка ${weaponId} успешна`);
      } else {
        let reason;
        switch (result?.reason) {
          case 'not_enough_money':
            reason = 'Недостаточно денег';
            break;
          case 'out_of_zone':
            reason = 'Вы вне зоны покупки';
            break;
          case 'invalid_weapon':
            reason = 'Оружие недоступно';
            break;
          default:
            reason = 'Недоступно';
        }
        this.hud.addFeedEntry(reason);
      }
    });
  }

  toggleBuyMenu(force) {
    const show = typeof force === 'boolean' ? force : !this.buyMenuOpen;
    if (show && !this.player.inBuyZone) {
      return;
    }
    this.buyMenuOpen = show;
    this.hud.toggleBuyMenu(show, this.player);
    if (show) {
      if (this.input.pointerLocked) {
        this.expectingPointerUnlock = true;
        document.exitPointerLock();
      }
    } else if (!this.input.pointerLocked && socket.connected) {
      this.controls.lock();
    }
  }

  updateBuyPrompt() {
    if (this.buyMenuOpen) {
      this.hud.showBuyPrompt(false);
      return;
    }
    this.hud.showBuyPrompt(this.player.inBuyZone && socket.connected);
  }

  resetNetworkStats({ preserveTarget = false } = {}) {
    this.networkStats.ping = null;
    this.networkStats.tickRate = null;
    this.networkStats.lastTick = null;
    this.networkStats.lastTime = null;
    if (!preserveTarget) {
      this.networkStats.targetTickRate = null;
    }
    this.updateNetworkStatsDisplay();
  }

  updateNetworkStatsDisplay() {
    this.hud.updateServerStats({
      ping: this.networkStats.ping,
      tickRate: this.networkStats.tickRate,
      targetTickRate: this.networkStats.targetTickRate
    });
  }

  startPingMonitor() {
    if (this.pingIntervalId || !socket.connected) {
      return;
    }
    this.measurePing();
    this.pingIntervalId = setInterval(() => this.measurePing(), 2000);
  }

  stopPingMonitor() {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
    if (this.pingTimeoutId) {
      clearTimeout(this.pingTimeoutId);
      this.pingTimeoutId = null;
    }
    this.awaitingPing = false;
  }

  measurePing() {
    if (!socket.connected || this.awaitingPing) {
      return;
    }
    this.awaitingPing = true;
    const start = performance.now();
    if (this.pingTimeoutId) {
      clearTimeout(this.pingTimeoutId);
    }
    this.pingTimeoutId = setTimeout(() => {
      this.awaitingPing = false;
      this.pingTimeoutId = null;
    }, 1200);
    socket.emit('clientPing', { start }, () => {
      this.awaitingPing = false;
      if (this.pingTimeoutId) {
        clearTimeout(this.pingTimeoutId);
        this.pingTimeoutId = null;
      }
      this.networkStats.ping = performance.now() - start;
      this.updateNetworkStatsDisplay();
    });
  }

  handleSnapshotTiming(snapshot) {
    if (!snapshot || typeof snapshot.tick !== 'number' || typeof snapshot.time !== 'number') {
      return;
    }
    if (this.networkStats.lastTick != null && this.networkStats.lastTime != null) {
      const tickDelta = snapshot.tick - this.networkStats.lastTick;
      const timeDelta = snapshot.time - this.networkStats.lastTime;
      if (tickDelta > 0 && timeDelta > 0) {
        const estimatedRate = tickDelta / timeDelta;
        this.networkStats.tickRate =
          this.networkStats.tickRate == null
            ? estimatedRate
            : THREE.MathUtils.lerp(this.networkStats.tickRate, estimatedRate, 0.2);
      }
    }
    this.networkStats.lastTick = snapshot.tick;
    this.networkStats.lastTime = snapshot.time;
    this.updateNetworkStatsDisplay();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = this.clock.getDelta();
    const now = performance.now() / 1000;

    this.controls.update(delta);
    const movementState = this.input.getMovementState();
    this.player.update(movementState, delta);
    const pitch = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ').x;
    const moving = movementState.forward || movementState.backward || movementState.left || movementState.right ? 1 : 0;
    this.firstPersonRig.update(delta, THREE.MathUtils.radToDeg(pitch), moving);
    this.updateWeaponState(now);
    this.sendInput(delta);
    this.remotePlayers.update(delta);
    this.updateBuyPrompt();
    this.hud.updatePlayerStats(this.player);

    this.renderer.render(this.scene, this.camera);
  }
}
