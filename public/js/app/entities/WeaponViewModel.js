import * as THREE from 'three';
import { WeaponDefinitions } from '../data/weapons.js';
import { buildFirstPersonWeapon } from './weaponGeometry.js';

const BASE_OFFSET = new THREE.Vector3(0.32, -0.38, -0.62);

export class WeaponViewModel {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.position.copy(BASE_OFFSET);
    this.group.rotation.order = 'YXZ';
    this.camera.add(this.group);

    this.currentWeaponId = null;
    this.weaponGroup = new THREE.Group();
    this.group.add(this.weaponGroup);

    this.muzzleFlash = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.16, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff4b0, transparent: true, opacity: 0 })
    );
    this.muzzleFlash.rotation.x = Math.PI / 2;
    this.weaponGroup.add(this.muzzleFlash);

    this.recoilOffset = new THREE.Vector3();
    this.recoilRotation = new THREE.Euler(0, 0, 0, 'YXZ');
    this.sway = new THREE.Vector2();
    this.reloadTime = 0;
    this.reloadProgress = 0;
    this.reloading = false;
  }

  equip(weaponId) {
    if (!weaponId || this.currentWeaponId === weaponId) {
      return;
    }
    const definition = WeaponDefinitions[weaponId];
    if (!definition) {
      return;
    }
    this.currentWeaponId = weaponId;
    this.weaponGroup.clear();
    this.weaponGroup.add(this.muzzleFlash);
    const weaponMesh = buildFirstPersonWeapon(definition);
    this.weaponGroup.add(weaponMesh);
    this.muzzleFlash.position.set(0, 0.08, -definition.model.length * 0.48);
    this.reloadTime = definition.reloadTime;
    this.reloading = false;
  }

  updateAmmo(state) {
    this.currentAmmoState = state;
  }

  kick() {
    this.recoilOffset.z -= 0.12;
    this.recoilRotation.x -= 0.08;
  }

  pulseMuzzle({ hit = false, headshot = false } = {}) {
    this.muzzleFlash.material.opacity = 0.8;
    this.muzzleFlash.material.color.set(headshot ? 0xff8080 : hit ? 0xc2ff8c : 0xfff4b0);
    this.muzzleFlash.scale.set(1, 1, 1);
  }

  setReloading(isReloading) {
    if (isReloading) {
      this.reloading = true;
      this.reloadProgress = 0;
    } else {
      this.reloading = false;
    }
  }

  update(delta, state) {
    const decay = Math.exp(-delta * 10);
    this.recoilOffset.multiplyScalar(decay);
    this.recoilRotation.x *= decay;
    this.recoilRotation.y *= decay;
    this.recoilRotation.z *= decay;

    const speed = state.velocity.length();
    this.sway.x = THREE.MathUtils.lerp(this.sway.x, state.yaw, delta * 5);

    const bob = Math.sin(performance.now() * 0.005 * (1 + speed * 0.2)) * Math.min(speed * 0.02, 0.05);

    if (this.reloading) {
      this.reloadProgress = Math.min(1, this.reloadProgress + delta / Math.max(this.reloadTime, 0.1));
    } else {
      this.reloadProgress = Math.max(0, this.reloadProgress - delta * 2);
    }

    const reloadTilt = Math.sin(this.reloadProgress * Math.PI) * 0.6;

    this.group.position.copy(BASE_OFFSET);
    this.group.position.y += bob;
    this.group.position.add(this.recoilOffset);

    this.group.rotation.x = -state.pitch * 0.18 + this.recoilRotation.x + reloadTilt * 0.2;
    this.group.rotation.y = this.recoilRotation.y;
    this.group.rotation.z = Math.sin(performance.now() * 0.004) * 0.02 + reloadTilt * 0.25;

    if (this.muzzleFlash.material.opacity > 0) {
      this.muzzleFlash.material.opacity = Math.max(0, this.muzzleFlash.material.opacity - delta * 6);
      const scale = 1 + (1 - this.muzzleFlash.material.opacity) * 1.5;
      this.muzzleFlash.scale.set(scale, scale, scale);
    }
  }
}
