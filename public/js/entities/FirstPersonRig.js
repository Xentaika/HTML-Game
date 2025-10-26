import * as THREE from 'three';

function createMaterial(color, { metalness = 0.2, roughness = 0.6 } = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function createFirstPersonWeapon(id) {
  const group = new THREE.Group();
  const dark = createMaterial(0x1b1f24, { metalness: 0.5, roughness: 0.3 });
  const polymer = createMaterial(0x2a3038, { metalness: 0.1, roughness: 0.7 });

  switch (id) {
    case 'knife': {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.32, 12), polymer);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(-0.05, -0.05, 0);
      group.add(handle);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.6), createMaterial(0xcfd8e3, { metalness: 0.9, roughness: 0.2 }));
      blade.position.set(0.24, 0.02, 0);
      group.add(blade);
      break;
    }
    case 'glock18':
    case 'deagle': {
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.18, 0.2), dark);
      slide.position.set(0.18, 0.08, 0);
      group.add(slide);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.22), polymer);
      grip.position.set(-0.05, -0.14, 0);
      grip.rotation.z = THREE.MathUtils.degToRad(-14);
      group.add(grip);
      break;
    }
    case 'mp9': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.22), polymer);
      body.position.set(0.18, 0.04, 0);
      group.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 12), dark);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.42, 0.1, 0);
      group.add(barrel);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.16), dark);
      mag.position.set(-0.08, -0.3, 0);
      group.add(mag);
      break;
    }
    case 'ak47': {
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(1, 0.22, 0.2), dark);
      receiver.position.set(0.2, 0.12, 0);
      group.add(receiver);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.16), createMaterial(0x7f4b27, { roughness: 0.8 }));
      stock.position.set(-0.45, 0.12, 0);
      group.add(stock);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.7, 14), createMaterial(0x262c31, { metalness: 0.7, roughness: 0.3 }));
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.48, 0.16, 0);
      group.add(barrel);
      const mag = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 16, 1, false, Math.PI / 2, Math.PI), polymer);
      mag.rotation.x = Math.PI / 2;
      mag.position.set(-0.05, -0.32, 0);
      group.add(mag);
      break;
    }
    case 'm4a1': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.24), polymer);
      body.position.set(0.14, 0.12, 0);
      group.add(body);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.2), polymer);
      stock.position.set(-0.38, 0.08, 0);
      group.add(stock);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 12), dark);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.52, 0.16, 0);
      group.add(barrel);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.24), polymer);
      grip.position.set(0.2, -0.1, 0);
      group.add(grip);
      break;
    }
    case 'awp': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.24, 0.24), createMaterial(0x2d463a, { roughness: 0.6 }));
      body.position.set(0.16, 0.12, 0);
      group.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 14), createMaterial(0x111417, { metalness: 0.7, roughness: 0.3 }));
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.75, 0.18, 0);
      group.add(barrel);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 18), createMaterial(0x1d2126, { metalness: 0.6, roughness: 0.4 }));
      scope.rotation.z = Math.PI / 2;
      scope.position.set(0.25, 0.28, 0);
      group.add(scope);
      break;
    }
    default: {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.2), polymer);
      base.position.set(0.1, 0.05, 0);
      group.add(base);
    }
  }

  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), createMaterial(0xfff2a0, { metalness: 0.1, roughness: 0.4 }));
  muzzle.name = 'muzzle';
  muzzle.visible = false;
  muzzle.position.set(0.6, 0.12, 0);
  group.add(muzzle);

  return group;
}

export class FirstPersonRig {
  constructor(camera) {
    this.camera = camera;
    this.root = new THREE.Group();
    this.root.position.set(0.45, -0.55, -0.8);
    this.root.rotation.set(0, Math.PI, 0);
    this.weaponHolder = new THREE.Group();
    this.root.add(this.weaponHolder);
    this.camera.add(this.root);

    this.currentWeaponId = null;
    this.weaponMesh = null;
    this.recoil = 0;
    this.reloadTimer = 0;
    this.reloadDuration = 0;
    this.bobTime = 0;
    this.muzzleFlashTime = 0;
  }

  setWeapon(weaponId) {
    if (this.currentWeaponId === weaponId) {
      return;
    }
    this.weaponHolder.clear();
    this.weaponMesh = createFirstPersonWeapon(weaponId);
    this.weaponHolder.add(this.weaponMesh);
    this.currentWeaponId = weaponId;
    this.recoil = 0;
  }

  triggerFire() {
    this.recoil = 0.18;
    this.muzzleFlashTime = 0.05;
    if (this.weaponMesh) {
      const muzzle = this.weaponMesh.getObjectByName('muzzle');
      if (muzzle) {
        muzzle.visible = true;
      }
    }
  }

  startReload(duration) {
    this.reloadTimer = duration;
    this.reloadDuration = duration;
  }

  update(delta, velocity = new THREE.Vector3(), cameraQuaternion = this.camera.quaternion) {
    const euler = new THREE.Euler().setFromQuaternion(cameraQuaternion, 'YXZ');
    const pitch = THREE.MathUtils.clamp(euler.x, -0.8, 0.8);
    const yaw = euler.y;

    this.root.position.x = 0.45 + Math.sin(yaw * 2) * 0.02;
    this.root.position.y = -0.55 + Math.sin(this.bobTime * 8) * 0.02;

    if (this.weaponHolder) {
      const targetPitch = -pitch * 0.35 - this.recoil;
      this.weaponHolder.rotation.x = THREE.MathUtils.lerp(this.weaponHolder.rotation.x, targetPitch, delta * 12);
      const sideways = Math.sin(this.bobTime * 4) * 0.12;
      this.weaponHolder.rotation.z = THREE.MathUtils.lerp(this.weaponHolder.rotation.z, sideways, delta * 10);
    }

    const speed = Math.min(1, velocity.length() / 8);
    this.bobTime += delta * (4 + speed * 6);

    if (this.recoil > 0) {
      this.recoil = Math.max(0, this.recoil - delta * 8);
    }

    if (this.reloadTimer > 0) {
      this.reloadTimer -= delta;
      const progress = 1 - Math.max(0, this.reloadTimer) / Math.max(this.reloadDuration, 0.001);
      const tilt = Math.sin(progress * Math.PI) * 0.7;
      this.weaponHolder.rotation.y = -tilt;
      this.weaponHolder.position.y = THREE.MathUtils.lerp(this.weaponHolder.position.y, -0.7, 0.2);
    } else {
      this.weaponHolder.rotation.y = THREE.MathUtils.lerp(this.weaponHolder.rotation.y, 0, delta * 6);
      this.weaponHolder.position.y = THREE.MathUtils.lerp(this.weaponHolder.position.y, 0, delta * 6);
    }

    if (this.muzzleFlashTime > 0) {
      this.muzzleFlashTime -= delta;
      if (this.weaponMesh) {
        const muzzle = this.weaponMesh.getObjectByName('muzzle');
        if (muzzle) {
          muzzle.visible = this.muzzleFlashTime > 0;
        }
      }
    } else if (this.weaponMesh) {
      const muzzle = this.weaponMesh.getObjectByName('muzzle');
      if (muzzle) {
        muzzle.visible = false;
      }
    }
  }
}
