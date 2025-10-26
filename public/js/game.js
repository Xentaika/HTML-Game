import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const socket = io({ autoConnect: false });

const LOCAL_SMOOTHING = 18;
const REMOTE_SMOOTHING = 10;
const SNAP_DISTANCE_SQ = 25;
const INPUT_INTERVAL = 1 / 90;

class HUDManager {
  constructor() {
    this.overlay = document.getElementById('overlay');
    this.startPrompt = document.getElementById('startPrompt');
    this.healthFill = document.getElementById('healthFill');
    this.healthValue = document.getElementById('healthValue');
    this.ammoDisplay = document.getElementById('ammoDisplay');
    this.reloadIndicator = document.getElementById('reloadIndicator');
    this.scoreDisplay = document.getElementById('scoreDisplay');
    this.eventFeed = document.getElementById('eventFeed');
    this.connectionStatus = document.getElementById('connectionStatus');
    this.crosshair = document.getElementById('crosshair');
    this.hitMarker = document.getElementById('hitMarker');

    this.crosshairTimeout = null;
    this.hitMarkerTimeout = null;
    this.hitMarkerHideTimeout = null;
  }

  updatePlayerStats(player) {
    if (!player) {
      return;
    }
    if (this.healthFill) {
      this.healthFill.style.width = `${player.health}%`;
      this.healthFill.style.background =
        player.health > 30
          ? 'linear-gradient(90deg, #38ffb5, #37d3ff)'
          : 'linear-gradient(90deg, #ff784f, #ff356b)';
    }
    if (this.healthValue) {
      this.healthValue.textContent = `${Math.max(0, Math.round(player.health))} HP`;
    }
    if (this.ammoDisplay) {
      this.ammoDisplay.textContent = `${player.weapon.ammo} / ${player.weapon.reserve}`;
    }
    if (this.scoreDisplay) {
      this.scoreDisplay.textContent = player.score;
    }
  }

  toggleStartPrompt(show) {
    if (!this.startPrompt) {
      return;
    }
    if (show) {
      this.startPrompt.classList.remove('hidden');
    } else {
      this.startPrompt.classList.add('hidden');
    }
  }

  setConnectionStatus(message, visible = true) {
    if (!this.connectionStatus) {
      return;
    }
    this.connectionStatus.textContent = message;
    if (visible) {
      this.connectionStatus.classList.remove('hidden');
    } else {
      this.connectionStatus.classList.add('hidden');
    }
  }

  setReloadIndicator(visible, message = 'Перезарядка…') {
    if (!this.reloadIndicator) {
      return;
    }
    if (visible) {
      this.reloadIndicator.textContent = message;
      this.reloadIndicator.classList.remove('hidden');
    } else {
      this.reloadIndicator.classList.add('hidden');
    }
  }

  animateCrosshair(state) {
    if (!this.crosshair) {
      return;
    }
    if (state === 'fire') {
      this.crosshair.classList.add('firing');
      clearTimeout(this.crosshairTimeout);
      this.crosshairTimeout = setTimeout(() => this.crosshair.classList.remove('firing'), 90);
    } else if (state === 'hit' || state === 'headshot') {
      this.crosshair.classList.remove('hit', 'headshot');
      this.crosshair.classList.add(state);
      clearTimeout(this.crosshairTimeout);
      this.crosshairTimeout = setTimeout(() => {
        this.crosshair.classList.remove('hit', 'headshot');
      }, 160);
    }
  }

  showHitMarker(headshot = false) {
    if (!this.hitMarker) {
      return;
    }
    this.hitMarker.classList.toggle('headshot', headshot);
    this.hitMarker.classList.remove('hidden');
    this.hitMarker.classList.add('visible');
    clearTimeout(this.hitMarkerTimeout);
    clearTimeout(this.hitMarkerHideTimeout);
    this.hitMarkerTimeout = setTimeout(() => {
      this.hitMarker.classList.remove('visible');
      this.hitMarkerHideTimeout = setTimeout(() => this.hitMarker.classList.add('hidden'), 90);
    }, 120);
  }

  addFeedEntry(text, headshot = false) {
    if (!this.eventFeed) {
      return;
    }
    const entry = document.createElement('div');
    entry.className = `feed-item${headshot ? ' headshot' : ''}`;
    entry.textContent = text;
    this.eventFeed.appendChild(entry);

    const items = this.eventFeed.querySelectorAll('.feed-item');
    if (items.length > 6) {
      items[0].remove();
    }

    setTimeout(() => entry.remove(), 8000);
  }
}

class Weapon {
  constructor() {
    this.magazineSize = 12;
    this.ammo = 12;
    this.reserve = 60;
    this.fireRate = 0.22;
    this.reloadDuration = 1.4;
    this.reloading = false;
    this.reloadEndTime = 0;
    this.lastShot = 0;
  }

  canShoot(time) {
    return !this.reloading && this.ammo > 0 && time - this.lastShot >= this.fireRate;
  }

  shoot(time) {
    if (!this.canShoot(time)) {
      return false;
    }
    this.lastShot = time;
    this.ammo -= 1;
    return true;
  }

  startReload(time) {
    if (this.reloading || this.ammo === this.magazineSize || this.reserve === 0) {
      return false;
    }
    this.reloading = true;
    this.reloadEndTime = time + this.reloadDuration;
    return true;
  }

  update(time) {
    if (!this.reloading || time < this.reloadEndTime) {
      return false;
    }
    const needed = this.magazineSize - this.ammo;
    const used = Math.min(needed, this.reserve);
    this.reserve -= used;
    this.ammo += used;
    this.reloading = false;
    return true;
  }

  reset() {
    this.ammo = this.magazineSize;
    this.reserve = 60;
    this.reloading = false;
    this.reloadEndTime = 0;
  }
}

class RemoteAvatar {
  constructor(id) {
    this.id = id;
    this.group = new THREE.Group();
    this.bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3bf5ff, emissive: 0x082a40 });
    this._buildAvatar();

    this.position = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.targetQuaternion = new THREE.Quaternion();
    this.health = 100;

    this.nameplate = document.createElement('div');
    this.nameplate.className = 'nameplate';
    this.nameplate.textContent = id.slice(0, 6);
    document.body.appendChild(this.nameplate);
  }

  _buildAvatar() {
    const avatar = new THREE.Group();
    avatar.position.y = -1.6;
    this.group.add(avatar);

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.1, 8, 16), this.bodyMaterial);
    body.position.y = 1.0;
    avatar.add(body);

    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xe2f7ff, emissive: 0x1c3d5b });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 24), headMaterial);
    head.position.y = 1.95;
    avatar.add(head);

    const weaponMaterial = new THREE.MeshStandardMaterial({ color: 0x0f1115, metalness: 0.6, roughness: 0.3, emissive: 0x132437 });
    const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 1.2), weaponMaterial);
    weapon.position.set(0.45, 1.2, -0.6);
    weapon.rotation.y = Math.PI / 10;
    avatar.add(weapon);
  }

  dispose(scene) {
    scene.remove(this.group);
    if (this.nameplate && this.nameplate.parentElement) {
      this.nameplate.remove();
    }
  }

  setSnapshot(snapshot) {
    if (!snapshot || !snapshot.position || !snapshot.quaternion) {
      return;
    }
    this.targetPosition.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
    this.targetQuaternion.set(snapshot.quaternion.x, snapshot.quaternion.y, snapshot.quaternion.z, snapshot.quaternion.w).normalize();

    if (this.position.distanceToSquared(this.targetPosition) > SNAP_DISTANCE_SQ) {
      this.position.copy(this.targetPosition);
      this.group.position.copy(this.position);
    }

    if (1 - Math.abs(this.quaternion.dot(this.targetQuaternion)) > 0.2) {
      this.quaternion.copy(this.targetQuaternion);
      this.group.quaternion.copy(this.quaternion);
    }
  }

  update(delta) {
    const alpha = 1 - Math.exp(-REMOTE_SMOOTHING * delta);
    if (alpha > 0) {
      this.position.lerp(this.targetPosition, alpha);
      this.quaternion.slerp(this.targetQuaternion, alpha);
    }
    this.group.position.copy(this.position);
    this.group.quaternion.copy(this.quaternion);
  }

  updateNameplate(camera) {
    const vector = this.group.position.clone();
    vector.y += 2.4;
    vector.project(camera);

    const outOfView =
      vector.z > 1 ||
      vector.x < -1 ||
      vector.x > 1 ||
      vector.y < -1 ||
      vector.y > 1;

    if (!this.nameplate) {
      return;
    }

    if (outOfView) {
      this.nameplate.style.opacity = '0';
      return;
    }

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
    this.nameplate.style.transform = `translate(${x}px, ${y}px) translate(-50%, -120%)`;
    this.nameplate.style.opacity = '1';
  }
}

class RemotePlayerManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.players = new Map();
  }

  ensure(id) {
    if (!this.players.has(id)) {
      const avatar = new RemoteAvatar(id);
      this.scene.add(avatar.group);
      this.players.set(id, avatar);
    }
    return this.players.get(id);
  }

  remove(id) {
    const avatar = this.players.get(id);
    if (!avatar) {
      return;
    }
    avatar.dispose(this.scene);
    this.players.delete(id);
  }

  applySnapshot(snapshot, localId) {
    if (!snapshot || !Array.isArray(snapshot.players)) {
      return;
    }
    const seen = new Set();
    snapshot.players.forEach((info) => {
      if (!info || !info.id || info.id === localId) {
        return;
      }
      const avatar = this.ensure(info.id);
      avatar.setSnapshot(info);
      seen.add(info.id);
    });

    this.players.forEach((_, id) => {
      if (!seen.has(id)) {
        this.remove(id);
      }
    });
  }

  update(delta) {
    this.players.forEach((avatar) => avatar.update(delta));
  }

  updateNameplates() {
    this.players.forEach((avatar) => avatar.updateNameplate(this.camera));
  }

  highlightDamage(targetId, headshot) {
    const avatar = this.players.get(targetId);
    if (!avatar) {
      return;
    }
    avatar.bodyMaterial.color.set(headshot ? 0xff3b81 : 0x37d3ff);
    setTimeout(() => {
      avatar.bodyMaterial.color.set(0x3bf5ff);
    }, 420);
  }

  setRespawn(targetId, position) {
    const avatar = this.players.get(targetId);
    if (!avatar || !position) {
      return;
    }
    avatar.position.set(position.x, position.y, position.z);
    avatar.targetPosition.copy(avatar.position);
    avatar.group.position.copy(avatar.position);
    avatar.health = 100;
  }
}

class LocalPlayer {
  constructor(controls) {
    this.id = null;
    this.position = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.health = 100;
    this.score = 0;
    this.weapon = new Weapon();
    this.controls = controls;
  }

  spawnAt(position) {
    if (!position) {
      return;
    }
    this.position.set(position.x, position.y, position.z);
    this.targetPosition.copy(this.position);
    const object = this.controls.getObject();
    object.position.copy(this.position);
  }

  applySnapshot(info) {
    if (!info || !info.position || !info.quaternion) {
      return;
    }
    const { x, y, z } = info.position;
    this.targetPosition.set(x, y, z);
    if (this.position.distanceToSquared(this.targetPosition) > SNAP_DISTANCE_SQ) {
      this.position.copy(this.targetPosition);
      this.controls.getObject().position.copy(this.position);
    }
    this.quaternion.set(info.quaternion.x, info.quaternion.y, info.quaternion.z, info.quaternion.w).normalize();
  }

  update(delta) {
    const alpha = 1 - Math.exp(-LOCAL_SMOOTHING * delta);
    if (alpha > 0) {
      this.position.lerp(this.targetPosition, alpha);
      this.controls.getObject().position.copy(this.position);
    }
  }

  resetOnRespawn(position) {
    this.weapon.reset();
    this.health = 100;
    this.spawnAt(position);
  }
}

class InputController {
  constructor(controls, hud, player) {
    this.controls = controls;
    this.hud = hud;
    this.player = player;
    this.keys = {};
    this.pointerLocked = false;
    this.pendingJump = false;
    this.inputAccumulator = 0;
    this.orientationCache = new THREE.Quaternion();
    this.onInput = () => {};
    this.onFire = () => {};
    this.onReload = () => {};
    this.onConnectRequest = () => {};
    this.bindEvents();
  }

  bindEvents() {
    document.addEventListener('keydown', (event) => {
      if (event.repeat) {
        return;
      }
      this.keys[event.code] = true;
      if (event.code === 'Space') {
        this.pendingJump = true;
      }
      if (event.code === 'KeyR') {
        this.onReload();
      }
      this.onInput();
    });

    document.addEventListener('keyup', (event) => {
      this.keys[event.code] = false;
      this.onInput();
    });

    document.addEventListener('mousedown', (event) => {
      if (event.button !== 0) {
        return;
      }
      if (!this.pointerLocked) {
        this.onConnectRequest();
        this.controls.lock();
      } else {
        this.onFire();
      }
    });

    this.controls.addEventListener('lock', () => {
      this.pointerLocked = true;
      if (this.hud.overlay) {
        this.hud.overlay.style.pointerEvents = 'none';
      }
    });

    this.controls.addEventListener('unlock', () => {
      this.pointerLocked = false;
      if (this.hud.overlay) {
        this.hud.overlay.style.pointerEvents = 'auto';
      }
      this.hud.toggleStartPrompt(true);
    });
  }

  buildInputPayload() {
    const quaternion = this.controls.getObject().quaternion;
    return {
      forward: this.keys['KeyW'] || false,
      backward: this.keys['KeyS'] || false,
      left: this.keys['KeyA'] || false,
      right: this.keys['KeyD'] || false,
      walk: Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']),
      jump: this.pendingJump,
      quaternion: {
        x: quaternion.x,
        y: quaternion.y,
        z: quaternion.z,
        w: quaternion.w
      }
    };
  }

  trackOrientationChanges() {
    const quaternion = this.controls.getObject().quaternion;
    const threshold = 0.00008;
    const changed =
      Math.abs(quaternion.x - this.orientationCache.x) > threshold ||
      Math.abs(quaternion.y - this.orientationCache.y) > threshold ||
      Math.abs(quaternion.z - this.orientationCache.z) > threshold ||
      Math.abs(quaternion.w - this.orientationCache.w) > threshold;
    if (changed) {
      this.onInput();
    }
  }

  acknowledgePayload(payload) {
    this.pendingJump = false;
    this.orientationCache.set(payload.quaternion.x, payload.quaternion.y, payload.quaternion.z, payload.quaternion.w);
  }
}

class ShooterGame {
  constructor() {
    this.canvas = document.getElementById('world');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050910);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.controls = new PointerLockControls(this.camera, document.body);
    this.controls.pointerSpeed = 0.28;
    this.scene.add(this.controls.getObject());

    this.clock = new THREE.Clock();

    this.hud = new HUDManager();
    this.player = new LocalPlayer(this.controls);
    this.remotePlayers = new RemotePlayerManager(this.scene, this.camera);
    this.input = new InputController(this.controls, this.hud, this.player);

    this.input.onInput = () => {
      this.inputDirty = true;
    };
    this.input.onFire = () => this.fireWeapon();
    this.input.onReload = () => this.reloadWeapon();
    this.input.onConnectRequest = () => this.connect();

    this.inputDirty = false;
    this.inputAccumulator = 0;

    this.tempVector = new THREE.Vector3();

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
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x0a0f23, metalness: 0.2, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const gridHelper = new THREE.GridHelper(120, 60, 0x0aefff, 0x083766);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);

    const obstacles = [
      { position: [0, 2, -12], scale: [4, 4, 4] },
      { position: [-10, 1.2, 6], scale: [6, 2.4, 4] },
      { position: [12, 3, 10], scale: [4, 6, 4] },
      { position: [-14, 2.5, -8], scale: [5, 5, 5] }
    ];

    obstacles.forEach(({ position, scale }) => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.6, 0.5),
        metalness: 0.4,
        roughness: 0.5
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.scale.set(...scale);
      this.scene.add(mesh);
      mesh.updateMatrixWorld(true);
    });

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(200, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x030712, side: THREE.BackSide })
    );
    this.scene.add(sky);

    const neonRings = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(30 + i * 4, 0.3, 16, 100),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x0df5ff : 0xff3bf5 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 8 + i * 1.2;
      neonRings.add(ring);
    }
    this.scene.add(neonRings);
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
      this.hud.setConnectionStatus('Подключено', false);
    });

    socket.on('disconnect', () => {
      this.hud.setConnectionStatus('Отключено от сервера');
    });

    socket.on('init', ({ id, snapshot }) => {
      this.player.id = id;
      this.hud.toggleStartPrompt(false);
      if (snapshot) {
        this.applySnapshot(snapshot);
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
    const now = performance.now() / 1000;
    if (this.player.weapon.startReload(now)) {
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

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = this.clock.getDelta();
    const now = performance.now() / 1000;

    this.sendInput(delta);
    this.player.update(delta);
    this.remotePlayers.update(delta);
    this.remotePlayers.updateNameplates();
    this.updateWeapon(now);

    this.renderer.render(this.scene, this.camera);
  }
}

new ShooterGame();
