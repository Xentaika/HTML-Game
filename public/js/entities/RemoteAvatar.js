import * as THREE from 'three';

const REMOTE_SMOOTHING = 14;
const POSITION_SNAP_DISTANCE_SQ = 36;

const BASE_COLOR = 0x5b6770;
const ACCENT_COLOR = 0x28313a;

function lerpAngle(a, b, t) {
  const diff = ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + diff * t;
}

function createWeaponMesh(id) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2d2f33, roughness: 0.4, metalness: 0.6 });
  const polymer = new THREE.MeshStandardMaterial({ color: 0x1c232b, roughness: 0.6 });
  switch (id) {
    case 'knife': {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.3, 8), polymer);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(0, -0.05, 0);
      group.add(handle);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.42), new THREE.MeshStandardMaterial({ color: 0xb7c7d6, metalness: 0.8, roughness: 0.2 }));
      blade.position.set(0.18, 0, 0);
      group.add(blade);
      break;
    }
    case 'deagle':
    case 'glock18': {
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.14), metal);
      slide.position.set(0.18, 0.05, 0);
      group.add(slide);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.16), polymer);
      grip.position.set(0.05, -0.12, 0);
      grip.rotation.z = THREE.MathUtils.degToRad(-12);
      group.add(grip);
      break;
    }
    case 'mp9': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.18), polymer);
      body.position.set(0.2, 0.05, 0);
      group.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.32, 10), metal);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.45, 0.08, 0);
      group.add(barrel);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.12), metal);
      mag.position.set(0.02, -0.24, 0);
      group.add(mag);
      break;
    }
    case 'ak47': {
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.18, 0.16), metal);
      receiver.position.set(0.25, 0.08, 0);
      group.add(receiver);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.12), new THREE.MeshStandardMaterial({ color: 0x7f4b27, roughness: 0.7 }));
      stock.position.set(-0.32, 0.08, 0);
      group.add(stock);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 12), metal);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.45, 0.12, 0);
      group.add(barrel);
      const mag = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.36, 12, 1, false, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0x222629, roughness: 0.4 }));
      mag.rotation.x = Math.PI / 2;
      mag.position.set(0.1, -0.18, 0);
      group.add(mag);
      break;
    }
    case 'm4a1': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.18), polymer);
      body.position.set(0.25, 0.08, 0);
      group.add(body);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.14), polymer);
      stock.position.set(-0.28, 0.05, 0);
      group.add(stock);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 12), metal);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.45, 0.1, 0);
      group.add(barrel);
      const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.18), polymer);
      foregrip.position.set(0.35, 0.05, 0);
      group.add(foregrip);
      break;
    }
    case 'awp': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.2), new THREE.MeshStandardMaterial({ color: 0x35604d, roughness: 0.5 }));
      body.position.set(0.2, 0.08, 0);
      group.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.8, 14), metal);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.65, 0.12, 0);
      group.add(barrel);
      const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.48, 16), new THREE.MeshStandardMaterial({ color: 0x1e242c, metalness: 0.7 }));
      scopeBody.rotation.z = Math.PI / 2;
      scopeBody.position.set(0.25, 0.22, 0);
      group.add(scopeBody);
      break;
    }
    default: {
      const fallback = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.16), polymer);
      fallback.position.set(0.1, 0.05, 0);
      group.add(fallback);
    }
  }
  group.position.set(0.45, 1.3, -0.3);
  group.rotation.y = -Math.PI / 2;
  return group;
}

export class RemoteAvatar {
  constructor(id) {
    this.id = id;
    this.group = new THREE.Group();
    this.group.position.y = 0;

    this.body = new THREE.Group();
    this.upperBody = new THREE.Group();
    this.weaponMount = new THREE.Group();

    this.bodyMaterial = new THREE.MeshStandardMaterial({ color: BASE_COLOR, roughness: 0.8, metalness: 0.1 });
    this.highlightMaterial = new THREE.Color(BASE_COLOR);

    this._buildAvatar();

    this.group.add(this.body);
    this.body.add(this.upperBody);
    this.upperBody.add(this.weaponMount);

    this.position = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.currentYaw = 0;
    this.targetYaw = 0;
    this.currentPitch = 0;
    this.targetPitch = 0;
    this.health = 100;
    this.activeWeapon = null;
    this.recoil = 0;
    this.reloadTimer = 0;
    this.reloadDuration = 0;

    this.nameplate = document.createElement('div');
    this.nameplate.className = 'nameplate';
    this.nameplate.textContent = id.slice(0, 6);
    document.body.appendChild(this.nameplate);
  }

  _buildAvatar() {
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.05, 12, 20), this.bodyMaterial);
    torso.position.y = 1.6;
    this.body.add(torso);

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 0.4), new THREE.MeshStandardMaterial({ color: ACCENT_COLOR, roughness: 0.7 }));
    vest.position.set(0, 1.6, -0.05);
    this.upperBody.add(vest);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 18, 18), new THREE.MeshStandardMaterial({ color: 0xd4d0c7, roughness: 0.6 }));
    head.position.set(0, 2.4, 0);
    this.upperBody.add(head);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 18, 0, Math.PI * 2, 0, Math.PI / 1.6), new THREE.MeshStandardMaterial({ color: 0x1f2326, metalness: 0.2, roughness: 0.7 }));
    helmet.position.copy(head.position);
    this.upperBody.add(helmet);

    const armMaterial = new THREE.MeshStandardMaterial({ color: 0x38434c, roughness: 0.6 });
    const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.9, 8, 16), armMaterial);
    leftArm.rotation.z = THREE.MathUtils.degToRad(18);
    leftArm.position.set(-0.45, 1.55, 0.05);
    this.upperBody.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.9, 8, 16), armMaterial);
    rightArm.rotation.z = THREE.MathUtils.degToRad(-18);
    rightArm.position.set(0.45, 1.55, 0.05);
    this.upperBody.add(rightArm);

    const legsMaterial = new THREE.MeshStandardMaterial({ color: 0x2b3137, roughness: 0.7 });
    const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.1, 10, 20), legsMaterial);
    leftLeg.position.set(-0.22, 0.5, 0);
    const rightLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.1, 10, 20), legsMaterial);
    rightLeg.position.set(0.22, 0.5, 0);
    this.body.add(leftLeg);
    this.body.add(rightLeg);
  }

  dispose(scene) {
    scene.remove(this.group);
    if (this.nameplate && this.nameplate.parentElement) {
      this.nameplate.remove();
    }
  }

  setWeapon(weaponId) {
    if (this.activeWeapon === weaponId) {
      return;
    }
    this.weaponMount.clear();
    const mesh = createWeaponMesh(weaponId);
    this.weaponMount.add(mesh);
    this.activeWeapon = weaponId;
  }

  setSnapshot(snapshot) {
    if (!snapshot || !snapshot.position) {
      return;
    }
    this.targetPosition.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
    if (this.position.distanceToSquared(this.targetPosition) > POSITION_SNAP_DISTANCE_SQ) {
      this.position.copy(this.targetPosition);
      this.group.position.copy(this.position);
    }
    if (snapshot.quaternion) {
      const quaternion = new THREE.Quaternion(snapshot.quaternion.x, snapshot.quaternion.y, snapshot.quaternion.z, snapshot.quaternion.w).normalize();
      const euler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
      this.targetYaw = euler.y;
      this.targetPitch = THREE.MathUtils.clamp(euler.x, -0.5, 0.5);
    }
    if (snapshot.health != null) {
      this.health = snapshot.health;
    }
    if (snapshot.activeWeapon) {
      this.setWeapon(snapshot.activeWeapon);
    }
  }

  startReload(duration) {
    this.reloadTimer = duration;
    this.reloadDuration = duration;
  }

  triggerFire() {
    this.recoil = 0.12;
  }

  applyHitIndicator(headshot) {
    const color = headshot ? 0xb71c1c : BASE_COLOR;
    this.bodyMaterial.color.set(color);
    setTimeout(() => {
      this.bodyMaterial.color.set(BASE_COLOR);
    }, 360);
  }

  update(delta) {
    const alpha = 1 - Math.exp(-REMOTE_SMOOTHING * delta);
    this.position.lerp(this.targetPosition, alpha);
    this.group.position.copy(this.position);

    this.currentYaw = lerpAngle(this.currentYaw, this.targetYaw, alpha * 1.4);
    this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, this.targetPitch, alpha * 1.2);

    this.body.rotation.y = this.currentYaw;
    const limitedPitch = THREE.MathUtils.clamp(this.currentPitch, -0.35, 0.35);
    this.upperBody.rotation.x = limitedPitch * 0.45;

    if (this.recoil > 0) {
      this.weaponMount.rotation.x = -this.recoil;
      this.recoil = Math.max(0, this.recoil - delta * 6);
    } else {
      this.weaponMount.rotation.x = THREE.MathUtils.lerp(this.weaponMount.rotation.x, limitedPitch * 0.6, alpha * 1.8);
    }

    if (this.reloadTimer > 0) {
      this.reloadTimer -= delta;
      const progress = 1 - Math.max(0, this.reloadTimer) / Math.max(0.001, this.reloadDuration);
      const tilt = Math.sin(progress * Math.PI) * 0.6;
      this.weaponMount.rotation.z = tilt;
    } else {
      this.weaponMount.rotation.z = THREE.MathUtils.lerp(this.weaponMount.rotation.z, 0, alpha * 2.2);
    }
  }

  updateNameplate(camera) {
    if (!this.nameplate) {
      return;
    }
    const screen = this.group.position.clone();
    screen.y += 2.4;
    screen.project(camera);
    if (screen.z > 1 || screen.z < -1) {
      this.nameplate.style.opacity = '0';
      return;
    }
    const x = (screen.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-screen.y * 0.5 + 0.5) * window.innerHeight;
    this.nameplate.style.transform = `translate(${x}px, ${y}px) translate(-50%, -130%)`;
    this.nameplate.style.opacity = '1';
  }
}
