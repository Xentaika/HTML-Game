import * as THREE from 'three';
import { WEAPON_PRESETS } from '../config/weaponPresets.js';

const SNAP_DISTANCE_SQ = 36;
const REMOTE_SMOOTHING = 12;

const BODY_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x3c4a55, roughness: 0.7, metalness: 0.1 });
const ARM_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xb9c2ca, roughness: 0.9 });
const GLOVE_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x2c2e31, roughness: 0.4 });

const WEAPON_COLORS = {
  knife: 0x60666b,
  glock18: 0x2f3032,
  deagle: 0x3b3f45,
  mp9: 0x353c40,
  ak47: 0x342f2b,
  m4a1: 0x2f363d,
  awp: 0x1f2428
};

export class RemoteAvatar {
  constructor(id) {
    this.id = id;
    this.group = new THREE.Group();
    this.group.position.y = 0;

    this.bodyRoot = new THREE.Group();
    this.group.add(this.bodyRoot);

    this.weaponPivot = new THREE.Group();
    this.weaponGroup = new THREE.Group();
    this.weaponPivot.position.set(0.3, 1.2, -0.45);
    this.bodyRoot.add(this.weaponPivot);
    this.weaponPivot.add(this.weaponGroup);

    this.currentWeaponId = null;
    this.reloadTimer = 0;
    this.reloadDuration = 0;
    this.recoilOffset = 0;
    this.pitch = 0;

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
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.0, 8, 16), BODY_MATERIAL);
    torso.position.y = 1.2;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 24), new THREE.MeshStandardMaterial({ color: 0xe0e5ea, roughness: 0.9 }));
    head.position.y = 2.15;

    const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.6, 8, 16), ARM_MATERIAL);
    leftArm.position.set(-0.42, 1.4, -0.1);
    leftArm.rotation.z = Math.PI * 0.35;

    const rightArm = leftArm.clone();
    rightArm.position.x = 0.42;
    rightArm.rotation.z = -Math.PI * 0.45;

    const leftGlove = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.2), GLOVE_MATERIAL);
    leftGlove.position.set(-0.54, 1.0, -0.26);
    const rightGlove = leftGlove.clone();
    rightGlove.position.x = 0.54;

    this.bodyRoot.add(torso, head, leftArm, rightArm, leftGlove, rightGlove);
  }

  _clearWeapon() {
    while (this.weaponGroup.children.length > 0) {
      const mesh = this.weaponGroup.children.pop();
      mesh.geometry.dispose();
      mesh.material.dispose?.();
    }
  }

  _buildWeapon(weaponId) {
    const preset = WEAPON_PRESETS[weaponId];
    const color = WEAPON_COLORS[weaponId] ?? 0x2f3235;
    const metal = new THREE.MeshStandardMaterial({ color, metalness: 0.45, roughness: 0.35 });
    const group = new THREE.Group();

    switch (weaponId) {
      case 'knife': {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.5), new THREE.MeshStandardMaterial({ color: 0xcfd6dc, metalness: 0.7, roughness: 0.2 }));
        blade.position.set(0, -0.05, -0.4);
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 12), metal);
        handle.rotation.z = Math.PI / 2;
        handle.position.set(0, -0.14, -0.28);
        group.add(blade, handle);
        break;
      }
      case 'mp9': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.6), metal);
        body.position.set(0, -0.1, -0.4);
        const foregrip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 12), metal.clone());
        foregrip.rotation.x = Math.PI / 2;
        foregrip.position.set(0.14, -0.22, -0.3);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.36), metal.clone());
        stock.position.set(-0.18, -0.14, -0.1);
        group.add(body, foregrip, stock);
        break;
      }
      case 'ak47': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.9), metal);
        body.position.set(0.02, -0.14, -0.52);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 16), metal.clone());
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0.02, -0.16, -0.94);
        const magazine = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.34, 16, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x553822, roughness: 0.5 }));
        magazine.rotation.x = Math.PI / 2;
        magazine.position.set(0.22, -0.34, -0.5);
        group.add(body, barrel, magazine);
        break;
      }
      case 'm4a1': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.86), metal);
        body.position.set(0.04, -0.14, -0.62);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.74, 16), metal.clone());
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0.04, -0.16, -1.02);
        const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.18), metal.clone());
        magazine.position.set(0.22, -0.32, -0.46);
        group.add(body, barrel, magazine);
        break;
      }
      case 'awp': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 1.2), metal);
        body.position.set(0.06, -0.16, -0.9);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.4, 16), metal.clone());
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0.04, -0.2, -1.4);
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 16), new THREE.MeshStandardMaterial({ color: 0x1d1f21, metalness: 0.6, roughness: 0.2 }));
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0.04, -0.02, -0.7);
        group.add(body, barrel, scope);
        break;
      }
      default: {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.6), metal);
        body.position.set(0, -0.14, -0.46);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.2), metal.clone());
        grip.position.set(0.06, -0.3, -0.28);
        group.add(body, grip);
        break;
      }
    }

    return group;
  }

  setWeapon(state) {
    if (!state || !state.id) {
      return;
    }
    if (state.id === this.currentWeaponId) {
      return;
    }
    this._clearWeapon();
    this.weaponGroup.add(this._buildWeapon(state.id));
    this.currentWeaponId = state.id;
  }

  setReloading(duration) {
    this.reloadDuration = duration;
    this.reloadTimer = duration;
  }

  triggerFire() {
    this.recoilOffset = 0.08;
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
    this.targetQuaternion
      .set(snapshot.quaternion.x, snapshot.quaternion.y, snapshot.quaternion.z, snapshot.quaternion.w)
      .normalize();
    this.pitch = snapshot.pitch || 0;
    this.health = snapshot.health;
    this.setWeapon(snapshot.weapon);

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
    this.position.lerp(this.targetPosition, alpha);
    this.quaternion.slerp(this.targetQuaternion, alpha);
    this.group.position.copy(this.position);
    this.group.quaternion.copy(this.quaternion);

    if (this.reloadTimer > 0) {
      this.reloadTimer = Math.max(0, this.reloadTimer - delta);
    }
    this.recoilOffset = Math.max(0, this.recoilOffset - delta * 0.25);

    const reloadProgress = this.reloadDuration > 0 ? 1 - this.reloadTimer / this.reloadDuration : 0;
    const reloadTilt = Math.sin(reloadProgress * Math.PI) * (this.reloadTimer > 0 ? -0.4 : 0);
    this.weaponPivot.rotation.x = this.pitch * 0.35 + reloadTilt + this.recoilOffset * -2.5;
  }

  updateNameplate(camera) {
    const vector = this.group.position.clone();
    vector.y += 2.4;
    vector.project(camera);

    const outOfView = vector.z > 1 || vector.x < -1 || vector.x > 1 || vector.y < -1 || vector.y > 1;

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
