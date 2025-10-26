import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');
const hud = document.getElementById('hud');
const crosshair = document.getElementById('crosshair');
const enemyHealthLabel = document.getElementById('enemyHealth');
const bodyHitsLabel = document.getElementById('bodyHits');
const headHitsLabel = document.getElementById('headHits');
const reloadLabel = document.getElementById('reload');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080b10);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
scene.add(camera);

const controls = new PointerLockControls(camera, document.body);

const clock = new THREE.Clock();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const upVector = new THREE.Vector3(0, 1, 0);
let canJump = false;

const moveState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  running: false
};

const gravity = 30;
const walkSpeed = 12;
const runSpeed = 20;
const jumpStrength = 12;
const baseCameraHeight = 4;
let bobValue = 0;

camera.position.set(0, baseCameraHeight, 6);

// Lights
const hemiLight = new THREE.HemisphereLight(0x88aaff, 0x202030, 0.6);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
dirLight.position.set(5, 20, 8);
scene.add(dirLight);

// Ground
const groundGeometry = new THREE.PlaneGeometry(200, 200);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1f2b, roughness: 1 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Simple arena walls
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x131722, metalness: 0.1, roughness: 0.8 });
for (let i = 0; i < 4; i++) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(200, 40, 2), wallMaterial);
  wall.position.y = 20;
  if (i % 2 === 0) {
    wall.position.z = i === 0 ? -100 : 100;
  } else {
    wall.position.x = i === 1 ? -100 : 100;
    wall.rotation.y = Math.PI / 2;
  }
  scene.add(wall);
}

// Enemy setup
const enemyGroup = new THREE.Group();
const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xd64541, roughness: 0.6, metalness: 0.1 });
const headMaterial = new THREE.MeshStandardMaterial({ color: 0xfde3a7, roughness: 0.3 });

const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.2, 3.6, 12, 24), bodyMaterial);
body.position.y = 3.8;
body.castShadow = true;
body.name = 'body';
const head = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 16), headMaterial);
head.position.y = 6.5;
head.castShadow = true;
head.name = 'head';

enemyGroup.add(body);
enemyGroup.add(head);
scene.add(enemyGroup);

enemyGroup.position.set(0, 0, -25);

const enemyState = {
  bodyHits: 0,
  headHits: 0,
  alive: true,
  swayOffset: Math.random() * Math.PI * 2
};

function resetEnemy() {
  enemyState.bodyHits = 0;
  enemyState.headHits = 0;
  enemyState.alive = true;
  enemyGroup.visible = true;
  enemyGroup.position.set((Math.random() - 0.5) * 40, 0, -20 - Math.random() * 20);
  enemyState.swayOffset = Math.random() * Math.PI * 2;
  updateHud();
}

function killEnemy(reason) {
  enemyState.alive = false;
  enemyGroup.visible = false;
  enemyHealthLabel.textContent = reason;
  setTimeout(resetEnemy, 2500);
}

function updateHud() {
  if (!enemyState.alive) {
    enemyHealthLabel.textContent = 'Цель повержена';
  } else {
    const bodyDamage = enemyState.bodyHits / 4;
    const headDamage = enemyState.headHits;
    const health = Math.max(0, 1 - bodyDamage - headDamage) * 100;
    enemyHealthLabel.textContent = `${health.toFixed(0)}%`;
  }
  bodyHitsLabel.textContent = enemyState.bodyHits.toString();
  headHitsLabel.textContent = enemyState.headHits.toString();
}

resetEnemy();

const raycaster = new THREE.Raycaster();
const shootDir = new THREE.Vector3();
const muzzleFlash = new THREE.PointLight(0xffddaa, 0, 3);
camera.add(muzzleFlash);

let lastShot = 0;
const fireCooldown = 0.35;

function shoot() {
  const now = performance.now() / 1000;
  if (now - lastShot < fireCooldown) {
    reloadLabel.textContent = 'перезарядка';
    reloadLabel.classList.remove('ready');
    reloadLabel.classList.add('cooldown');
    return;
  }

  lastShot = now;
  reloadLabel.textContent = 'перезарядка';
  reloadLabel.classList.remove('ready');
  reloadLabel.classList.add('cooldown');

  setTimeout(() => {
    if (performance.now() / 1000 - lastShot >= fireCooldown) {
      reloadLabel.textContent = 'готов';
      reloadLabel.classList.remove('cooldown');
      reloadLabel.classList.add('ready');
    }
  }, fireCooldown * 1000);

  muzzleFlash.intensity = 1.2;
  setTimeout(() => {
    muzzleFlash.intensity = 0;
  }, 80);

  camera.getWorldDirection(shootDir);
  raycaster.set(camera.getWorldPosition(new THREE.Vector3()), shootDir);

  if (!enemyState.alive) {
    return;
  }

  const intersects = raycaster.intersectObjects([head, body], false);

  if (intersects.length > 0) {
    const hit = intersects[0];
    if (hit.object === head) {
      enemyState.headHits = 1;
      updateHud();
      killEnemy('Хедшот!');
    } else if (hit.object === body) {
      enemyState.bodyHits = Math.min(4, enemyState.bodyHits + 1);
      updateHud();
      if (enemyState.bodyHits >= 4) {
        killEnemy('Тело поражено');
      }
    }
  }
}

function animateEnemy(time) {
  const sway = Math.sin(time * 0.0015 + enemyState.swayOffset) * 3;
  enemyGroup.position.x = THREE.MathUtils.lerp(enemyGroup.position.x, sway, 0.03);
  enemyGroup.rotation.y = Math.sin(time * 0.0012 + enemyState.swayOffset) * 0.3;
}

function onKeyDown(event) {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveState.forward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveState.left = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveState.backward = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveState.right = true;
      break;
    case 'Space':
      if (canJump) {
        velocity.y = jumpStrength;
        canJump = false;
      }
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      moveState.running = true;
      break;
  }
}

function onKeyUp(event) {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveState.forward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveState.left = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveState.backward = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveState.right = false;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      moveState.running = false;
      break;
  }
}

function updateMovement(delta) {
  if (!controls.isLocked) return;

  const speed = moveState.running ? runSpeed : walkSpeed;
  direction.z = Number(moveState.forward) - Number(moveState.backward);
  direction.x = Number(moveState.right) - Number(moveState.left);
  direction.normalize();

  if (moveState.forward || moveState.backward) {
    velocity.z -= direction.z * speed * delta;
  } else {
    velocity.z = THREE.MathUtils.damp(velocity.z, 0, 5, delta);
  }

  if (moveState.left || moveState.right) {
    velocity.x -= direction.x * speed * delta;
  } else {
    velocity.x = THREE.MathUtils.damp(velocity.x, 0, 5, delta);
  }

  velocity.y -= gravity * delta;

  controls.moveRight(-velocity.x * delta);
  controls.moveForward(-velocity.z * delta);

  camera.position.y += velocity.y * delta;

  if (camera.position.y < baseCameraHeight) {
    velocity.y = 0;
    camera.position.y = baseCameraHeight;
    canJump = true;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(0.1, clock.getDelta());
  const elapsed = performance.now();

  updateMovement(delta);
  if (enemyState.alive) {
    animateEnemy(elapsed);
  }

  renderer.render(scene, camera);
}

animate();

// Pointer lock events
controls.addEventListener('lock', () => {
  overlay.classList.add('hidden');
  hud.classList.remove('hidden');
  crosshair.classList.remove('hidden');
});

controls.addEventListener('unlock', () => {
  overlay.classList.remove('hidden');
  hud.classList.add('hidden');
  crosshair.classList.add('hidden');
});

overlay.addEventListener('click', () => {
  controls.lock();
});

document.addEventListener('pointerdown', (event) => {
  if (event.button === 0 && controls.isLocked) {
    shoot();
  }
});

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Prevent context menu from interrupting the flow
window.addEventListener('contextmenu', (event) => event.preventDefault());

// Subtle head bobbing when moving
function applyHeadBobbing(time) {
  if (!controls.isLocked) return;
  const moving = moveState.forward || moveState.backward || moveState.left || moveState.right;
  const target = moving ? Math.sin(time * 0.015) * 0.18 : 0;
  bobValue = THREE.MathUtils.damp(bobValue, target, 10, 0.016);
  if (camera.position.y <= baseCameraHeight + 0.01) {
    camera.position.y = baseCameraHeight + bobValue;
  }
}

(function bobLoop() {
  requestAnimationFrame(bobLoop);
  applyHeadBobbing(performance.now());
})();
