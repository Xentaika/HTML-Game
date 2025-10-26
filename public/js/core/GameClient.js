import * as THREE from 'three';
import { HUDOverlay } from './HUD.js';
import { socket } from './network.js';
import { LocalPlayer } from '../entities/LocalPlayer.js';
import { RemotePlayerManager } from '../entities/RemotePlayerManager.js';
import { InputController } from './InputController.js';
import { ArenaBuilder } from '../scenes/ArenaBuilder.js';
import { SmoothPointerLockControls } from './SmoothPointerLockControls.js';

const INPUT_INTERVAL = 1 / 90;

export class GameClient {
  constructor() {
    this.canvas = document.getElementById('world');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050910);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.controls = new SmoothPointerLockControls(this.camera, this.renderer.domElement, {
      pointerSpeed: 0.22,
      smoothingFactor: 0,
      maxRotationStep: Infinity
    });
    this.scene.add(this.controls.getObject());

    this.clock = new THREE.Clock();

    this.hud = new HUDOverlay();
    this.player = new LocalPlayer(this.controls);
    this.remotePlayers = new RemotePlayerManager(this.scene, this.camera);
    this.input = new InputController(this.controls, this.hud);

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

    this.input.onInput = () => {
      this.inputDirty = true;
    };
    this.input.onFire = () => this.fireWeapon();
    this.input.onReload = () => this.reloadWeapon();
    this.input.onConnectRequest = () => this.connect();

    this.inputDirty = false;
    this.inputAccumulator = 0;

    this.setupLighting();
    this.buildArena();
    this.setupEvents();
    this.setupSocket();
    this.animate();
  }

  setupLighting() {
    const ambient = new THREE.AmbientLight(0x7ddaff, 0.3);
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(0x00bfff, 0.6);
    directional.position.set(10, 20, 8);
    this.scene.add(directional);
  }

  buildArena() {
    ArenaBuilder.build(this.scene);
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
    });

    socket.on('init', ({ id, snapshot, tickRate }) => {
      this.player.id = id;
      this.hud.toggleStartPrompt(false);
      this.networkStats.targetTickRate = typeof tickRate === 'number' ? tickRate : null;
      this.resetNetworkStats({ preserveTarget: true });
      if (snapshot) {
        this.applySnapshot(snapshot);
        this.handleSnapshotTiming(snapshot);
      }
      const quaternion = this.controls.getObject().quaternion;
      this.input.orientationCache.copy(quaternion);
      this.hud.updatePlayerStats(this.player);
    });

    socket.on('playerJoined', (info) => {
      if (!info || info.id === this.player.id) {
        return;
      }
      const avatar = this.remotePlayers.ensure(info.id);
      avatar.position.set(info.position.x, info.position.y, info.position.z);
      avatar.targetPosition.copy(avatar.position);
      avatar.group.position.copy(avatar.position);
      if (info.quaternion) {
        avatar.quaternion
          .set(info.quaternion.x, info.quaternion.y, info.quaternion.z, info.quaternion.w)
          .normalize();
        avatar.targetQuaternion.copy(avatar.quaternion);
        avatar.group.quaternion.copy(avatar.quaternion);
      }
      this.hud.addFeedEntry(`Игрок ${info.id.slice(0, 6)} подключился`);
    });

    socket.on('stateSnapshot', (snapshot) => {
      if (!snapshot) {
        return;
      }
      this.applySnapshot(snapshot);
      this.handleSnapshotTiming(snapshot);
    });

    socket.on('playerLeft', ({ id }) => {
      this.remotePlayers.remove(id);
      this.hud.addFeedEntry(`Игрок ${id.slice(0, 6)} покинул арену`);
    });

    socket.on('playerHit', ({ shooterId, targetId, damage, headshot, remaining }) => {
      if (targetId === this.player.id) {
        this.player.health = remaining;
        if (remaining <= 0) {
          this.hud.addFeedEntry(
            `Вы были устранены игроком ${shooterId.slice(0, 6)}${headshot ? ' (хедшот)' : ''}`,
            headshot
          );
        } else {
          this.hud.addFeedEntry(`Вас ранил ${shooterId.slice(0, 6)} (${damage})`, headshot);
        }
        this.hud.updatePlayerStats(this.player);
      } else {
        this.remotePlayers.highlightDamage(targetId, headshot);
      }

      if (shooterId === this.player.id) {
        this.hud.addFeedEntry(`Вы попали по ${targetId.slice(0, 6)}${headshot ? ' (хедшот)' : ''}`, headshot);
        this.hud.showHitMarker(headshot);
        this.hud.animateCrosshair(headshot ? 'headshot' : 'hit');
      }
    });

    socket.on('playerEliminated', ({ targetId, killerId, respawn, score }) => {
      if (targetId === this.player.id) {
        this.player.resetOnRespawn(respawn);
        this.hud.setReloadIndicator(false);
        this.hud.updatePlayerStats(this.player);
      } else {
        this.remotePlayers.setRespawn(targetId, respawn);
      }

      if (killerId === this.player.id && typeof score === 'number') {
        this.player.score = score;
        this.hud.updatePlayerStats(this.player);
        this.hud.addFeedEntry(`Вы устранили ${targetId.slice(0, 6)}!`);
      } else if (targetId === this.player.id) {
        this.hud.addFeedEntry(`Игрок ${killerId.slice(0, 6)} вас устранил`);
      } else {
        this.hud.addFeedEntry(`${killerId.slice(0, 6)} устранил ${targetId.slice(0, 6)}`);
      }
    });
  }

  applySnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.players)) {
      return;
    }
    snapshot.players.forEach((info) => {
      if (!info || !info.id) {
        return;
      }
      if (info.id === this.player.id) {
        this.player.applySnapshot(info);
        this.player.health = info.health;
        this.player.score = info.score;
        this.hud.updatePlayerStats(this.player);
      } else {
        const avatar = this.remotePlayers.ensure(info.id);
        avatar.setSnapshot(info);
      }
    });
    this.remotePlayers.applySnapshot(snapshot, this.player.id);
  }

  sendInput(delta) {
    if (!socket.connected || !this.player.id) {
      return;
    }
    this.inputAccumulator += delta;
    this.input.trackOrientationChanges();

    if (!this.inputDirty && !this.input.pendingJump && this.inputAccumulator < INPUT_INTERVAL) {
      return;
    }

    const payload = this.input.buildInputPayload();
    socket.emit('input', payload);
    this.inputAccumulator = 0;
    this.inputDirty = false;
    this.input.acknowledgePayload(payload);
  }

  fireWeapon() {
    if (!socket.connected || !this.player.id) {
      return;
    }
    const now = performance.now() / 1000;
    if (!this.player.weapon.canShoot(now)) {
      if (this.player.weapon.ammo === 0) {
        this.reloadWeapon();
      }
      return;
    }

    if (this.player.weapon.shoot(now)) {
      this.hud.animateCrosshair('fire');
      this.hud.updatePlayerStats(this.player);
      const origin = this.controls.getObject().position.clone();
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      socket.emit('shoot', {
        origin: { x: origin.x, y: origin.y, z: origin.z },
        direction: { x: direction.x, y: direction.y, z: direction.z }
      });
      this.inputDirty = true;
    }
  }

  reloadWeapon() {
    if (!socket.connected || !this.player.id) {
      return;
    }
    const now = performance.now() / 1000;
    if (this.player.weapon.startReload(now)) {
      socket.emit('reload');
      this.hud.setReloadIndicator(true);
      this.hud.addFeedEntry('Перезарядка…');
    }
  }

  updateWeapon(time) {
    if (this.player.weapon.update(time)) {
      this.hud.setReloadIndicator(false);
      this.hud.updatePlayerStats(this.player);
    }
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
    this.sendInput(delta);
    this.player.update(delta);
    this.remotePlayers.update(delta);
    this.remotePlayers.updateNameplates();
    this.updateWeapon(now);

    this.renderer.render(this.scene, this.camera);
  }
}
