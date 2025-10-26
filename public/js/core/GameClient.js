import * as THREE from 'three';
import { HUDOverlay } from './HUD.js';
import { socket } from './network.js';
import { LocalPlayer } from '../entities/LocalPlayer.js';
import { RemotePlayerManager } from '../entities/RemotePlayerManager.js';
import { InputController } from './InputController.js';
import { ArenaBuilder } from '../scenes/ArenaBuilder.js';
import { SmoothPointerLockControls } from './SmoothPointerLockControls.js';
import { MOVEMENT_CONFIG } from '../config/movementConfig.js';
import { FirstPersonRig } from '../entities/FirstPersonRig.js';

const FIXED_STEP = MOVEMENT_CONFIG.fixedDelta;

export class GameClient {
  constructor() {
    this.canvas = document.getElementById('world');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8797a4);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.controls = new SmoothPointerLockControls(this.camera, this.renderer.domElement, {
      pointerSpeed: 0.24,
      smoothingFactor: 0.12,
      maxRotationStep: 0.035
    });
    this.scene.add(this.controls.getObject());

    this.clock = new THREE.Clock();
    this.accumulator = 0;

    this.hud = new HUDOverlay();
    this.player = new LocalPlayer(this.controls);
    this.remotePlayers = new RemotePlayerManager(this.scene, this.camera);
    this.input = new InputController(this.controls, this.hud);
    this.firstPersonRig = new FirstPersonRig(this.controls.getObject());

    this.pendingInputs = [];
    this.lastNetworkTick = 0;
    this.buyMenuOpen = false;
    this.weaponDefinitions = {};

    this.networkStats = {
      ping: null,
      tickRate: MOVEMENT_CONFIG.tickRate,
      targetTickRate: MOVEMENT_CONFIG.tickRate
    };
    this.awaitingPing = false;
    this.pingInterval = null;

    this.setupLighting();
    this.buildArena();
    this.setupEvents();
    this.setupInputBindings();
    this.setupSocket();

    this.animate();
  }

  setupLighting() {
    const ambient = new THREE.AmbientLight(0x9faab3, 0.45);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xf2ede2, 0.75);
    sun.position.set(12, 24, 10);
    sun.castShadow = false;
    this.scene.add(sun);

    const fill = new THREE.HemisphereLight(0xbcc7d1, 0x3a433f, 0.45);
    this.scene.add(fill);
  }

  buildArena() {
    ArenaBuilder.build(this.scene);
  }

  setupEvents() {
    window.addEventListener('resize', () => this.handleResize());
    this.handleResize();

    if (this.hud.startPrompt) {
      this.hud.startPrompt.addEventListener('click', () => {
        this.connect();
        this.controls.lock();
        this.hud.toggleStartPrompt(false);
      });
    }
  }

  setupInputBindings() {
    this.input.onInput = () => {
      if (!socket.connected) {
        return;
      }
    };

    this.input.onFire = () => this.handleLocalFire();
    this.input.onReload = () => this.handleLocalReload();
    this.input.onConnectRequest = () => this.connect();
    this.input.onToggleBuy = () => this.toggleBuyMenu();
    this.input.onSelectSlot = (slot) => this.handleSlotSelect(slot);
  }

  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  connect() {
    if (socket.connected || socket.active) {
      return;
    }
    this.hud.setConnectionStatus('Подключение…');
    socket.connect();
  }

  setupSocket() {
    socket.on('connect', () => {
      this.pendingInputs = [];
      this.startPingMonitor();
      this.hud.setConnectionStatus('Подключено', false);
      this.hud.toggleStartPrompt(false);
    });

    socket.on('disconnect', () => {
      this.stopPingMonitor();
      this.hud.setConnectionStatus('Отключено от сервера');
      this.buyMenuOpen = false;
      this.hud.toggleBuyMenu(false);
    });

    socket.on('init', ({ id, snapshot, tickRate, weapons }) => {
      this.player.id = id;
      if (tickRate) {
        this.networkStats.targetTickRate = tickRate;
      }
      this.hud.updateServerStats(this.networkStats);
      if (weapons) {
        this.weaponDefinitions = weapons;
        this.hud.setWeaponDefinitions(weapons, (weaponId) => this.requestBuy(weaponId));
      }
      if (snapshot) {
        this.applySnapshot(snapshot);
      }
      this.hud.toggleStartPrompt(false);
    });

    socket.on('stateSnapshot', (snapshot) => {
      this.applySnapshot(snapshot);
    });

    socket.on('playerJoined', (info) => {
      if (!info || info.id === this.player.id) {
        return;
      }
      const avatar = this.remotePlayers.ensure(info.id);
      avatar.setSnapshot(info);
      this.hud.addFeedEntry(`Игрок ${info.id.slice(0, 6)} присоединился`);
    });

    socket.on('playerLeft', ({ id }) => {
      this.remotePlayers.remove(id);
      this.hud.addFeedEntry(`Игрок ${id.slice(0, 6)} покинул матч`);
    });

    socket.on('weaponFired', (data) => {
      if (!data) {
        return;
      }
      if (data.shooterId === this.player.id) {
        const weapon = this.player.getActiveWeapon();
        if (weapon) {
          weapon.ammo = data.ammo;
          weapon.reserve = data.reserve;
          weapon.reloading = data.reloading;
        }
        this.hud.setWeaponInfo(this.getActiveWeaponName(), weapon?.ammo, weapon?.reserve);
      } else {
        this.remotePlayers.handleWeaponFired(data.shooterId, data.weaponId);
      }
    });

    socket.on('playerHit', (payload) => this.handlePlayerHit(payload));

    socket.on('playerEliminated', ({ targetId, killerId, respawn, score }) => {
      if (targetId === this.player.id && respawn) {
        this.player.spawnAt(respawn);
        this.pendingInputs = [];
        this.hud.setReloadIndicator(false);
      } else {
        this.remotePlayers.setRespawn(targetId, respawn);
      }
      if (killerId === this.player.id && typeof score === 'number') {
        this.player.score = score;
        this.hud.updatePlayerStats(this.player);
      }
    });

    socket.on('reloadStarted', ({ weaponId, endTime }) => {
      if (!weaponId) {
        return;
      }
      const weapon = this.player.getActiveWeapon();
      if (weapon && weapon.id === weaponId) {
        weapon.reloading = true;
        weapon.reloadEndTime = endTime;
        const duration = Math.max(0, endTime - Date.now() / 1000);
        this.firstPersonRig.startReload(duration);
        this.hud.setReloadIndicator(true);
      }
    });

    socket.on('remoteReload', ({ playerId, endTime }) => {
      const duration = Math.max(0, endTime - Date.now() / 1000);
      this.remotePlayers.handleReload(playerId, duration);
    });

    socket.on('inventoryUpdate', (payload) => {
      this.handleInventoryUpdate(payload);
    });

    socket.on('playerPurchased', ({ playerId, weaponId }) => {
      if (playerId !== this.player.id && weaponId) {
        this.hud.addFeedEntry(`Игрок ${playerId.slice(0, 6)} купил ${weaponId}`);
      }
    });
  }

  startPingMonitor() {
    this.stopPingMonitor();
    this.pingInterval = setInterval(() => {
      if (this.awaitingPing || !socket.connected) {
        return;
      }
      this.awaitingPing = true;
      const start = performance.now();
      socket.emit('clientPing', null, () => {
        const end = performance.now();
        this.networkStats.ping = end - start;
        this.hud.updateServerStats(this.networkStats);
        this.awaitingPing = false;
      });
    }, 2000);
  }

  stopPingMonitor() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.awaitingPing = false;
  }

  handleLocalFire() {
    if (!socket.connected) {
      return;
    }
    const weapon = this.player.getActiveWeapon();
    if (!weapon) {
      return;
    }
    const now = performance.now() / 1000;
    const shot = weapon.pullTrigger(now);
    if (!shot) {
      return;
    }
    this.hud.animateCrosshair('fire');
    this.firstPersonRig.triggerFire();
    this.hud.setWeaponInfo(this.getActiveWeaponName(), weapon.ammo, weapon.reserve);
    socket.emit('shoot');
  }

  handleLocalReload() {
    if (!socket.connected) {
      return;
    }
    const weapon = this.player.getActiveWeapon();
    if (!weapon) {
      return;
    }
    const now = performance.now() / 1000;
    const result = weapon.startReload(now);
    if (!result) {
      return;
    }
    this.firstPersonRig.startReload(result.duration);
    this.hud.setReloadIndicator(true);
    socket.emit('reload');
  }

  handleSlotSelect(slot) {
    if (!socket.connected) {
      return;
    }
    const weaponId = this.findWeaponIdForSlot(slot);
    if (!weaponId) {
      return;
    }
    socket.emit('equipWeapon', { weaponId });
  }

  findWeaponIdForSlot(slot) {
    if (!slot) {
      return null;
    }
    let found = null;
    this.player.weapons.forEach((weapon) => {
      const def = weapon.definition;
      if (def && (def.slot === slot || def.id === slot)) {
        found = weapon.id;
      }
    });
    return found;
  }

  requestBuy(weaponId) {
    if (!socket.connected || !weaponId) {
      return;
    }
    socket.emit('buyWeapon', { weaponId });
  }

  toggleBuyMenu(forceState) {
    const inZone = this.player.inBuyZone;
    if (!inZone && !this.buyMenuOpen) {
      this.hud.addFeedEntry('Вы вне зоны закупки');
      return;
    }
    const nextState = forceState != null ? forceState : !this.buyMenuOpen;
    this.buyMenuOpen = nextState;
    this.hud.toggleBuyMenu(this.buyMenuOpen);
    this.hud.updateBuyAvailability(this.player.wallet, this.player.inBuyZone);
    if (this.buyMenuOpen) {
      if (this.controls.isLocked) {
        this.controls.unlock();
      }
    } else if (!this.controls.isLocked) {
      this.controls.lock();
    }
  }

  handleInventoryUpdate(payload) {
    if (!payload) {
      return;
    }
    if (!payload.ok) {
      if (payload.reason === 'funds') {
        this.hud.addFeedEntry('Недостаточно средств для покупки');
      } else if (payload.reason === 'zone') {
        this.hud.addFeedEntry('Купить оружие можно только в зоне закупки');
      }
      return;
    }
    if (payload.wallet != null) {
      this.player.wallet = payload.wallet;
    }
    if (Array.isArray(payload.weapons)) {
      payload.weapons.forEach((weaponInfo) => {
        const weapon = this.player.ensureWeapon(weaponInfo.id);
        if (weapon) {
          weapon.applySnapshot(weaponInfo);
        }
      });
      this.hud.updateInventory(payload.weapons, payload.activeWeapon);
    }
    if (payload.activeWeapon) {
      this.player.activeWeaponId = payload.activeWeapon;
      this.firstPersonRig.setWeapon(payload.activeWeapon);
      this.hud.setReloadIndicator(false);
    }
    this.hud.setWallet(this.player.wallet);
    const activeWeapon = this.player.getActiveWeapon();
    this.hud.setWeaponInfo(this.getActiveWeaponName(), activeWeapon?.ammo, activeWeapon?.reserve);
    if (payload.context === 'buy') {
      const weaponName = this.weaponDefinitions[payload.activeWeapon]?.name || payload.activeWeapon;
      this.hud.addFeedEntry(`Вы приобрели ${weaponName}`);
    }
    this.hud.updateBuyAvailability(this.player.wallet, this.player.inBuyZone);
  }

  handlePlayerHit({ shooterId, targetId, damage, headshot, remaining }) {
    if (!shooterId || !targetId) {
      return;
    }
    if (targetId === this.player.id) {
      this.player.health = remaining;
      this.hud.addFeedEntry(`По вам попали (${damage})`, headshot);
      this.hud.updatePlayerStats(this.player);
      if (remaining <= 0) {
        this.hud.addFeedEntry(`Вы были устранены игроком ${shooterId.slice(0, 6)}`, headshot);
      }
    } else {
      this.remotePlayers.highlightDamage(targetId, headshot);
    }
    if (shooterId === this.player.id) {
      this.hud.addFeedEntry(`Попадание по ${targetId.slice(0, 6)}${headshot ? ' (хедшот)' : ''}`, headshot);
      this.hud.showHitMarker(headshot);
      this.hud.animateCrosshair(headshot ? 'headshot' : 'hit');
    }
  }

  applySnapshot(snapshot) {
    if (!snapshot) {
      return;
    }
    this.remotePlayers.applySnapshot(snapshot, this.player.id);
    const localInfo = Array.isArray(snapshot.players)
      ? snapshot.players.find((player) => player.id === this.player.id)
      : null;
    if (localInfo) {
      this.player.reconcile(localInfo, this.pendingInputs);
      this.pendingInputs = this.pendingInputs.filter((input) => input.sequence > this.player.lastProcessedInput);
      this.hud.updatePlayerStats(this.player);
      const weapon = this.player.getActiveWeapon();
      if (weapon) {
        this.firstPersonRig.setWeapon(weapon.id);
        this.hud.setWeaponInfo(this.getActiveWeaponName(), weapon.ammo, weapon.reserve);
        if (!weapon.reloading) {
          this.hud.setReloadIndicator(false);
        }
      }
      this.hud.setWallet(this.player.wallet);
      this.hud.updateBuyAvailability(this.player.wallet, this.player.inBuyZone);
      this.hud.updateInventory(localInfo.weapons, localInfo.activeWeapon);
      if (this.buyMenuOpen && !this.player.inBuyZone) {
        this.toggleBuyMenu(false);
      }
    }
  }

  getActiveWeaponName() {
    const weapon = this.player.getActiveWeapon();
    if (!weapon) {
      return 'Без оружия';
    }
    const definition = weapon.definition;
    return definition?.name || weapon.id;
  }

  update(delta) {
    if (this.controls.update) {
      this.controls.update(delta);
    }
    const velocity = this.player.velocity.clone();
    this.firstPersonRig.update(delta, velocity, this.controls.getObject().quaternion);
    this.remotePlayers.update(delta);
    this.remotePlayers.updateNameplates();

    if (socket.connected && this.controls.isLocked) {
      this.accumulator += delta;
      while (this.accumulator >= FIXED_STEP) {
        this.stepSimulation(FIXED_STEP);
        this.accumulator -= FIXED_STEP;
      }
    } else {
      this.accumulator = 0;
    }
  }

  stepSimulation(delta) {
    const payload = this.input.buildInputPayload();
    this.pendingInputs.push({ sequence: payload.sequence, payload, delta });
    this.player.simulateInput(payload, delta, MOVEMENT_CONFIG);
    this.input.acknowledgePayload(payload);
    if (socket.connected) {
      socket.emit('input', payload);
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = this.clock.getDelta();
    this.update(delta);
    this.renderer.render(this.scene, this.camera);
  }
}
