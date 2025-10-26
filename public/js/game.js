import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const socket = io({ autoConnect: false });

const canvas = document.getElementById('world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050910);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
const controls = new PointerLockControls(camera, document.body);
controls.pointerSpeed = 0.32;
scene.add(controls.getObject());

const ambient = new THREE.AmbientLight(0x7ddaff, 0.3);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0x00bfff, 0.6);
directional.position.set(10, 20, 8);
scene.add(directional);

const clock = new THREE.Clock();

const overlay = document.getElementById('overlay');
const startPrompt = document.getElementById('startPrompt');
const healthFill = document.getElementById('healthFill');
const healthValue = document.getElementById('healthValue');
const ammoDisplay = document.getElementById('ammoDisplay');
const reloadIndicator = document.getElementById('reloadIndicator');
const scoreDisplay = document.getElementById('scoreDisplay');
const eventFeed = document.getElementById('eventFeed');
const connectionStatus = document.getElementById('connectionStatus');
const crosshair = document.getElementById('crosshair');
const hitMarker = document.getElementById('hitMarker');

const player = {
  id: null,
  position: new THREE.Vector3(),
  targetPosition: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  ammo: 12,
  magazineSize: 12,
  reserve: 60,
  reloading: false,
  reloadTimer: null,
  lastShot: 0,
  fireRate: 0.22,
  health: 100,
  score: 0
};

const keys = {};
const remotePlayers = new Map();

const LOCAL_SMOOTHING = 16;
const REMOTE_SMOOTHING = 9;
const SNAP_DISTANCE_SQ = 36;
const tempVector = new THREE.Vector3();

let inputDirty = false;
let pendingJump = false;
const orientationCache = { x: 0, y: 0, z: 0, w: 1 };
let inputAccumulator = 0;
const INPUT_INTERVAL = 1 / 120;
const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight']);
let pointerLocked = false;
let hitMarkerTimeout = null;
let hitMarkerHideTimeout = null;
let crosshairTimeout = null;

function setReloadIndicator(visible, message = 'Перезарядка…') {
  if (!reloadIndicator) return;
  if (visible) {
    reloadIndicator.textContent = message;
    reloadIndicator.classList.remove('hidden');
  } else {
    reloadIndicator.classList.add('hidden');
  }
}

function animateCrosshair(state) {
  if (!crosshair) return;
  if (state === 'fire') {
    crosshair.classList.add('firing');
    clearTimeout(crosshairTimeout);
    crosshairTimeout = setTimeout(() => crosshair.classList.remove('firing'), 90);
  } else if (state === 'hit' || state === 'headshot') {
    crosshair.classList.remove('headshot', 'hit');
    crosshair.classList.add(state === 'headshot' ? 'headshot' : 'hit');
    clearTimeout(crosshairTimeout);
    crosshairTimeout = setTimeout(() => {
      crosshair.classList.remove('headshot', 'hit');
    }, 140);
  }
}

function showHitMarker(headshot = false) {
  if (!hitMarker) return;
  hitMarker.classList.remove('headshot');
  if (headshot) {
    hitMarker.classList.add('headshot');
  }
  hitMarker.classList.remove('hidden');
  hitMarker.classList.add('visible');
  clearTimeout(hitMarkerTimeout);
  clearTimeout(hitMarkerHideTimeout);
  hitMarkerTimeout = setTimeout(() => {
    hitMarker.classList.remove('visible');
    hitMarkerHideTimeout = setTimeout(() => {
      hitMarker.classList.add('hidden');
    }, 80);
  }, 120);
}

function buildArena() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0x0a0f23, metalness: 0.2, roughness: 0.8 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const gridHelper = new THREE.GridHelper(120, 60, 0x0aefff, 0x083766);
  gridHelper.position.y = 0.01;
  scene.add(gridHelper);

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
    scene.add(mesh);
    mesh.updateMatrixWorld(true);

  });

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(200, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0x030712,
      side: THREE.BackSide
    })
  );
  scene.add(sky);

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
  scene.add(neonRings);
}

function createRemoteAvatar(id) {
  const group = new THREE.Group();

  const avatar = new THREE.Group();
  avatar.position.y = -1.6;
  group.add(avatar);

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3bf5ff, emissive: 0x082a40 });
  const bodyGeometry = new THREE.CapsuleGeometry(0.45, 1.1, 8, 16);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1.0;
  body.castShadow = true;
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

  const nameplate = document.createElement('div');
  nameplate.className = 'nameplate';
  nameplate.textContent = id.slice(0, 6);
  document.body.appendChild(nameplate);

  remotePlayers.set(id, {
    group,
    nameplate,
    bodyMaterial,
    position: new THREE.Vector3(),
    targetPosition: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    targetQuaternion: new THREE.Quaternion(),
    health: 100,
    score: 0
  });

  const remote = remotePlayers.get(id);
  remote.position.copy(group.position);
  remote.targetPosition.copy(group.position);
  remote.quaternion.copy(group.quaternion);
  remote.targetQuaternion.copy(group.quaternion);

  scene.add(group);
}

function removeRemoteAvatar(id) {
  const remote = remotePlayers.get(id);
  if (!remote) return;
  scene.remove(remote.group);
  remote.nameplate.remove();
  remotePlayers.delete(id);
}

function smoothLocalPlayer(delta) {
  if (!player.targetPosition) {
    return;
  }
  const alpha = 1 - Math.exp(-LOCAL_SMOOTHING * delta);
  if (alpha <= 0) {
    return;
  }
  player.position.lerp(player.targetPosition, alpha);
  controls.getObject().position.copy(player.position);
}

function updateRemotePlayerTransforms(delta) {
  const alpha = 1 - Math.exp(-REMOTE_SMOOTHING * delta);
  remotePlayers.forEach((remote) => {
    if (alpha > 0) {
      remote.position.lerp(remote.targetPosition, alpha);
      remote.quaternion.slerp(remote.targetQuaternion, alpha);
    } else {
      remote.position.copy(remote.targetPosition);
      remote.quaternion.copy(remote.targetQuaternion);
    }
    remote.group.position.copy(remote.position);
    remote.group.quaternion.copy(remote.quaternion);
  });
}

function updateNameplates() {
  remotePlayers.forEach((remote) => {
    const vector = remote.group.position.clone();
    vector.y += 2.4;
    vector.project(camera);

    const outOfView =
      vector.z > 1 ||
      vector.x < -1 ||
      vector.x > 1 ||
      vector.y < -1 ||
      vector.y > 1;

    if (outOfView) {
      remote.nameplate.style.opacity = '0';
      return;
    }

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
    remote.nameplate.style.transform = `translate(${x}px, ${y}px) translate(-50%, -120%)`;
    remote.nameplate.style.opacity = '1';
  });
}

function addFeedEntry(text, headshot = false) {
  const entry = document.createElement('div');
  entry.className = `feed-item${headshot ? ' headshot' : ''}`;
  entry.textContent = text;
  eventFeed.appendChild(entry);

  const items = eventFeed.querySelectorAll('.feed-item');
  if (items.length > 6) {
    items[0].remove();
  }

  setTimeout(() => {
    entry.remove();
  }, 8000);
}

function updateHUD() {
  healthFill.style.width = `${player.health}%`;
  healthFill.style.background = player.health > 30 ? 'linear-gradient(90deg, #38ffb5, #37d3ff)' : 'linear-gradient(90deg, #ff784f, #ff356b)';
  healthValue.textContent = `${Math.max(0, Math.round(player.health))} HP`;
  ammoDisplay.textContent = `${player.ammo} / ${player.reserve}`;
  scoreDisplay.textContent = player.score;
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function connect() {
  if (socket.connected) {
    return;
  }
  connectionStatus.classList.remove('hidden');
  socket.connect();
}

function spawnAt(position) {
  player.position.set(position.x, position.y, position.z);
  player.targetPosition.copy(player.position);
  controls.getObject().position.copy(player.position);
}

function fireWeapon() {
  const now = performance.now() / 1000;
  if (player.reloading || player.ammo <= 0 || now - player.lastShot < player.fireRate) {
    return;
  }
  player.lastShot = now;
  player.ammo -= 1;
  updateHUD();
  animateCrosshair('fire');

  const origin = controls.getObject().position.clone();
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  socket.emit('shoot', {
    origin: { x: origin.x, y: origin.y, z: origin.z },
    direction: { x: direction.x, y: direction.y, z: direction.z }
  });
}

function reloadWeapon() {
  if (player.reloading || player.ammo === player.magazineSize || player.reserve === 0) {
    return;
  }
  player.reloading = true;
  setReloadIndicator(true);
  addFeedEntry('Перезарядка…');
  if (player.reloadTimer) {
    clearTimeout(player.reloadTimer);
  }
  player.reloadTimer = setTimeout(() => {
    const needed = player.magazineSize - player.ammo;
    const used = Math.min(needed, player.reserve);
    player.reserve -= used;
    player.ammo += used;
    player.reloading = false;
    player.reloadTimer = null;
    setReloadIndicator(false);
    updateHUD();
  }, 1400);
}

function trackOrientationChanges() {
  const quaternion = controls.getObject().quaternion;
  const threshold = 0.0001;
  if (
    Math.abs(quaternion.x - orientationCache.x) > threshold ||
    Math.abs(quaternion.y - orientationCache.y) > threshold ||
    Math.abs(quaternion.z - orientationCache.z) > threshold ||
    Math.abs(quaternion.w - orientationCache.w) > threshold
  ) {
    inputDirty = true;
  }
}

function buildInputPayload() {
  const quaternion = controls.getObject().quaternion;
  return {
    forward: keys['KeyW'] || false,
    backward: keys['KeyS'] || false,
    left: keys['KeyA'] || false,
    right: keys['KeyD'] || false,
    sprint: keys['ShiftLeft'] || keys['ShiftRight'] || false,
    jump: pendingJump,
    quaternion: {
      x: quaternion.x,
      y: quaternion.y,
      z: quaternion.z,
      w: quaternion.w
    }
  };
}

function transmitInput() {
  if (!socket.connected || !player.id) {
    return;
  }
  const payload = buildInputPayload();
  socket.emit('input', payload);
  inputAccumulator = 0;
  pendingJump = false;
  inputDirty = false;
  orientationCache.x = payload.quaternion.x;
  orientationCache.y = payload.quaternion.y;
  orientationCache.z = payload.quaternion.z;
  orientationCache.w = payload.quaternion.w;
}

function sendInput(delta) {
  if (!socket.connected || !player.id) {
    return;
  }

  inputAccumulator += delta;
  if (!inputDirty && !pendingJump && inputAccumulator < INPUT_INTERVAL) {
    return;
  }

  transmitInput();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  trackOrientationChanges();
  sendInput(delta);
  smoothLocalPlayer(delta);
  updateRemotePlayerTransforms(delta);
  renderer.render(scene, camera);
  updateNameplates();
}

function initEvents() {
  document.addEventListener('keydown', (event) => {
    if (event.code === 'KeyR') {
      if (!event.repeat) {
        reloadWeapon();
      }
      return;
    }

    if (event.repeat) {
      return;
    }

    keys[event.code] = true;

    if (event.code === 'Space') {
      event.preventDefault();
      pendingJump = true;
      inputDirty = true;
    } else if (MOVEMENT_KEYS.has(event.code)) {
      inputDirty = true;
    }

    sendInput(0);
  });

  document.addEventListener('keyup', (event) => {
    keys[event.code] = false;
    if (event.code === 'Space') {
      event.preventDefault();
      inputDirty = true;
    } else if (MOVEMENT_KEYS.has(event.code)) {
      inputDirty = true;
    }

    sendInput(0);
  });

  document.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      if (!pointerLocked) {
        if (!socket.connected) {
          connect();
        }
        startPrompt.classList.add('hidden');
        controls.lock();
      } else {
        fireWeapon();
      }
    }
  });

  controls.addEventListener('lock', () => {
    pointerLocked = true;
    overlay.style.pointerEvents = 'none';
  });

  controls.addEventListener('unlock', () => {
    pointerLocked = false;
    overlay.style.pointerEvents = 'auto';
    startPrompt.classList.remove('hidden');
  });

  window.addEventListener('resize', handleResize);
  handleResize();
}

function setupSocket() {
  socket.on('connect', () => {
    connectionStatus.textContent = 'Подключено';
    setTimeout(() => connectionStatus.classList.add('hidden'), 400);
  });

  socket.on('disconnect', () => {
    connectionStatus.textContent = 'Отключено от сервера';
    connectionStatus.classList.remove('hidden');
  });

  socket.on('init', ({ id, players: serverPlayers }) => {
    player.id = id;
    serverPlayers.forEach((info) => {
      if (!info || !info.id) {
        return;
      }
      if (info.id === id) {
        spawnAt(info.position);
        player.health = info.health;
        player.score = info.score;
        if (info.quaternion) {
          player.quaternion.set(info.quaternion.x, info.quaternion.y, info.quaternion.z, info.quaternion.w).normalize();
        }
      } else {
        createRemoteAvatar(info.id);
        const remote = remotePlayers.get(info.id);
        remote.position.set(info.position.x, info.position.y, info.position.z);
        remote.targetPosition.copy(remote.position);
        remote.group.position.copy(remote.position);
        if (info.quaternion) {
          remote.quaternion.set(info.quaternion.x, info.quaternion.y, info.quaternion.z, info.quaternion.w).normalize();
          remote.targetQuaternion.copy(remote.quaternion);
          remote.group.quaternion.copy(remote.quaternion);
        }
      }
    });
    const currentQuat = controls.getObject().quaternion;
    orientationCache.x = currentQuat.x;
    orientationCache.y = currentQuat.y;
    orientationCache.z = currentQuat.z;
    orientationCache.w = currentQuat.w;
    updateHUD();
  });

  socket.on('playerJoined', (info) => {
    if (info.id === player.id) return;
    createRemoteAvatar(info.id);
    const remote = remotePlayers.get(info.id);
    remote.position.set(info.position.x, info.position.y, info.position.z);
    remote.targetPosition.copy(remote.position);
    remote.group.position.copy(remote.position);
    if (info.quaternion) {
      remote.quaternion.set(info.quaternion.x, info.quaternion.y, info.quaternion.z, info.quaternion.w).normalize();
      remote.targetQuaternion.copy(remote.quaternion);
      remote.group.quaternion.copy(remote.quaternion);
    }
    addFeedEntry(`Игрок ${info.id.slice(0, 6)} подключился`);
  });

  socket.on('stateSnapshot', ({ players: serverPlayers }) => {
    if (!Array.isArray(serverPlayers)) {
      return;
    }

    serverPlayers.forEach((info) => {
      if (!info || !info.id || !info.position || !info.quaternion) {
        return;
      }

      if (info.id === player.id) {
        const { x, y, z } = info.position;
        tempVector.set(x, y, z);
        if (player.position.distanceToSquared(tempVector) > SNAP_DISTANCE_SQ) {
          player.position.copy(tempVector);
          player.targetPosition.copy(tempVector);
          controls.getObject().position.copy(player.position);
        } else {
          player.targetPosition.copy(tempVector);
        }
        player.quaternion.set(info.quaternion.x, info.quaternion.y, info.quaternion.z, info.quaternion.w).normalize();
      } else {
        if (!remotePlayers.has(info.id)) {
          createRemoteAvatar(info.id);
        }
        const remote = remotePlayers.get(info.id);
        if (!remote) {
          return;
        }
        const { x, y, z } = info.position;
        remote.targetPosition.set(x, y, z);
        if (remote.position.distanceToSquared(remote.targetPosition) > SNAP_DISTANCE_SQ) {
          remote.position.copy(remote.targetPosition);
          remote.group.position.copy(remote.position);
        }
        remote.targetQuaternion
          .set(info.quaternion.x, info.quaternion.y, info.quaternion.z, info.quaternion.w)
          .normalize();
        if (1 - Math.abs(remote.quaternion.dot(remote.targetQuaternion)) > 0.2) {
          remote.quaternion.copy(remote.targetQuaternion);
          remote.group.quaternion.copy(remote.quaternion);
        }
      }
    });
  });

  socket.on('playerLeft', ({ id }) => {
    removeRemoteAvatar(id);
    addFeedEntry(`Игрок ${id.slice(0, 6)} покинул арену`);
  });

  socket.on('playerHit', ({ shooterId, targetId, damage, headshot, remaining }) => {
    if (targetId === player.id) {
      player.health = remaining;
      if (player.health <= 0) {
        addFeedEntry(`Вы были устранены игроком ${shooterId.slice(0, 6)}${headshot ? ' (хедшот)' : ''}`, headshot);
      } else {
        addFeedEntry(`Вас ранил ${shooterId.slice(0, 6)} (${damage})`, headshot);
      }
      updateHUD();
    } else if (remotePlayers.has(targetId)) {
      const remote = remotePlayers.get(targetId);
      remote.health = remaining;
      remote.bodyMaterial.color.set(headshot ? 0xff3b81 : 0x37d3ff);
      setTimeout(() => {
        remote.bodyMaterial.color.set(0x3bf5ff);
      }, 400);
    }

    if (shooterId === player.id) {
      addFeedEntry(`Вы попали по ${targetId.slice(0, 6)}${headshot ? ' (хедшот)' : ''}`, headshot);
      showHitMarker(headshot);
      animateCrosshair(headshot ? 'headshot' : 'hit');
    }
  });

  socket.on('playerEliminated', ({ targetId, killerId, respawn, score }) => {
    if (targetId === player.id) {
      spawnAt(respawn);
      player.health = 100;
      player.ammo = player.magazineSize;
      player.reserve = 60;
      player.reloading = false;
      if (player.reloadTimer) {
        clearTimeout(player.reloadTimer);
        player.reloadTimer = null;
      }
      setReloadIndicator(false);
      updateHUD();
    } else if (remotePlayers.has(targetId)) {
      const remote = remotePlayers.get(targetId);
      remote.position.set(respawn.x, respawn.y, respawn.z);
      remote.targetPosition.copy(remote.position);
      remote.group.position.copy(remote.position);
      remote.health = 100;
    }

    if (killerId === player.id) {
      player.score = score;
      updateHUD();
      addFeedEntry(`Вы устранили ${targetId.slice(0, 6)}!`, false);
    } else if (targetId === player.id) {
      addFeedEntry(`Игрок ${killerId.slice(0, 6)} вас устранил`, false);
    } else {
      addFeedEntry(`${killerId.slice(0, 6)} устранил ${targetId.slice(0, 6)}`);
    }
  });
}

startPrompt.addEventListener('click', () => {
  startPrompt.classList.add('hidden');
  connect();
  controls.lock();
});

buildArena();
initEvents();
setupSocket();
animate();
