import * as THREE from 'three';
const WEAPON_COLORS = {
  knife: 0x60666b,
  glock18: 0x2f3032,
  deagle: 0x3b3f45,
  mp9: 0x353c40,
  ak47: 0x342f2b,
  m4a1: 0x2f363d,
  awp: 0x1f2428
};

export class FirstPersonRig {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.position.set(0.32, -0.38, -0.8);
    this.group.rotation.set(-0.08, 0, 0);
    this.camera.add(this.group);

    this.armsGroup = new THREE.Group();
    this.weaponGroup = new THREE.Group();
    this.group.add(this.armsGroup);
    this.group.add(this.weaponGroup);

    this.currentWeaponId = null;
    this.recoilOffset = 0;
    this.reloadTimer = 0;
    this.reloadDuration = 0;
    this.bobPhase = 0;

    this._buildArms();
  }

  dispose() {
    this.camera.remove(this.group);
  }

  _buildArms() {
    const material = new THREE.MeshStandardMaterial({ color: 0xc7cdd2, roughness: 0.8 });
    const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 6, 12), material);
    leftArm.position.set(-0.18, -0.08, -0.38);
    leftArm.rotation.z = Math.PI * 0.18;

    const rightArm = leftArm.clone();
    rightArm.position.x = 0.18;
    rightArm.rotation.z = -Math.PI * 0.22;

    const gloveMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.5 });
    const leftGlove = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22), gloveMaterial);
    leftGlove.position.set(-0.22, -0.26, -0.4);
    const rightGlove = leftGlove.clone();
    rightGlove.position.x = 0.22;

    this.armsGroup.add(leftArm, rightArm, leftGlove, rightGlove);
  }

  _clearWeapon() {
    while (this.weaponGroup.children.length > 0) {
      const mesh = this.weaponGroup.children.pop();
      mesh.geometry.dispose();
      mesh.material.dispose?.();
    }
  }

  _buildWeaponGeometry(weaponId) {
    const color = WEAPON_COLORS[weaponId] ?? 0x2f3235;
    const metal = new THREE.MeshStandardMaterial({ color, metalness: 0.45, roughness: 0.35 });
    const group = new THREE.Group();

    switch (weaponId) {
      case 'knife': {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.5), new THREE.MeshStandardMaterial({ color: 0xced4d9, metalness: 0.7, roughness: 0.2 }));
        blade.position.set(0, -0.1, -0.6);
        blade.rotation.x = Math.PI * 0.12;
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.18, 12), metal);
        handle.rotation.z = Math.PI / 2;
        handle.position.set(0, -0.24, -0.4);
        group.add(blade, handle);
        break;
      }
      case 'deagle': {
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.46), metal);
        slide.position.set(0, -0.18, -0.44);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.2), metal.clone());
        grip.position.set(0, -0.32, -0.32);
        grip.rotation.x = Math.PI * 0.1;
        group.add(slide, grip);
        break;
      }
      case 'mp9': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.54), metal);
        body.position.set(0, -0.2, -0.5);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.4), metal.clone());
        stock.position.set(-0.14, -0.22, -0.2);
        const foregrip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.28, 12), metal.clone());
        foregrip.rotation.x = Math.PI / 2;
        foregrip.position.set(0.12, -0.28, -0.4);
        group.add(body, stock, foregrip);
        break;
      }
      case 'ak47': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.7), metal);
        body.position.set(0.02, -0.22, -0.62);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 12), metal.clone());
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, -0.24, -0.95);
        const magazine = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.32, 16, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x4f3423, roughness: 0.5 }));
        magazine.rotation.x = Math.PI / 2;
        magazine.position.set(0.16, -0.38, -0.58);
        group.add(body, barrel, magazine);
        break;
      }
      case 'm4a1': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.62), metal);
        body.position.set(0.02, -0.22, -0.58);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 12), metal.clone());
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, -0.22, -0.94);
        const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.28), metal.clone());
        handguard.position.set(0.08, -0.23, -0.72);
        const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.16), metal.clone());
        magazine.position.set(0.16, -0.36, -0.52);
        group.add(body, barrel, handguard, magazine);
        break;
      }
      case 'awp': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.82), metal);
        body.position.set(0.04, -0.24, -0.78);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 16), metal.clone());
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0.02, -0.26, -1.2);
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.46, 16), new THREE.MeshStandardMaterial({ color: 0x1a1d1f, metalness: 0.6, roughness: 0.2 }));
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0.04, -0.12, -0.72);
        group.add(body, barrel, scope);
        break;
      }
      default: {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.46), metal);
        body.position.set(0, -0.2, -0.52);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.18), metal.clone());
        grip.position.set(0.02, -0.34, -0.36);
        group.add(body, grip);
      }
    }

    return group;
  }

  setWeapon(weaponId) {
    if (weaponId === this.currentWeaponId) {
      return;
    }
    this._clearWeapon();
    const weapon = this._buildWeaponGeometry(weaponId);
    this.weaponGroup.add(weapon);
    this.currentWeaponId = weaponId;
  }

  triggerFire() {
    this.recoilOffset = 0.08;
  }

  triggerReload(duration) {
    this.reloadDuration = duration;
    this.reloadTimer = duration;
  }

  update(delta, { speed = 0, pitch = 0 } = {}) {
    const bobStrength = Math.min(speed / 10, 1);
    this.bobPhase += delta * (6 + bobStrength * 4);
    const bobOffset = Math.sin(this.bobPhase) * 0.015 * bobStrength;

    this.recoilOffset = Math.max(0, this.recoilOffset - delta * 0.22);
    const recoilZ = -this.recoilOffset;

    if (this.reloadTimer > 0) {
      this.reloadTimer = Math.max(0, this.reloadTimer - delta);
    }
    const reloadProgress = this.reloadDuration > 0 ? 1 - this.reloadTimer / this.reloadDuration : 0;
    const reloadTilt = Math.sin(reloadProgress * Math.PI) * (this.reloadTimer > 0 ? -0.5 : 0);

    this.group.position.y = -0.38 + bobOffset;
    this.group.position.z = -0.8 + recoilZ;
    this.group.rotation.x = -0.08 + pitch * 0.2 + reloadTilt * 0.1;
    this.group.rotation.z = Math.sin(this.bobPhase * 0.5) * 0.05 * bobStrength;
  }
}
