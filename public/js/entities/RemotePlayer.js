import * as THREE from 'three';

const SMOOTHING = 12;
const SNAP_DISTANCE_SQ = 36;

function buildBodyMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x6d7064, metalness: 0.2, roughness: 0.7 });
}

function buildWeaponModel(template) {
  const group = new THREE.Group();
  const baseColor = template.category === 'Sniper' ? 0x2f3133 : 0x252728;
  const accent = template.category === 'Pistols' ? 0x4d4f50 : 0x3c3f41;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.12 + template.magazineSize * 0.002, 0.18, 0.9),
    new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.5, roughness: 0.35 })
  );
  body.position.set(0, 0, -0.32);
  group.add(body);

  if (!template || template.slot === 'melee') {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.02, 0.45),
      new THREE.MeshStandardMaterial({ color: 0xcfd2cf, metalness: 0.7, roughness: 0.25 })
    );
    blade.position.set(0, 0, -0.25);
    group.add(blade);
    return group;
  }

  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.3, 0.18),
    new THREE.MeshStandardMaterial({ color: accent, metalness: 0.35, roughness: 0.6 })
  );
  grip.position.set(-0.05, -0.2, -0.05);
  grip.rotation.x = THREE.MathUtils.degToRad(16);
  group.add(grip);

  if (template.category === 'Sniper') {
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.05, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x1f2122, metalness: 0.6, roughness: 0.2 })
    );
    scope.rotation.z = Math.PI / 2;
    scope.position.set(0, 0.12, -0.3);
    group.add(scope);
  }

  if (template.category === 'SMGs' || template.category === 'Rifles' || template.slot === 'primary') {
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.4, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x2a2c2d, metalness: 0.45, roughness: 0.4 })
    );
    mag.position.set(0.08, -0.28, -0.12);
    mag.rotation.x = THREE.MathUtils.degToRad(20);
    group.add(mag);
  }

  return group;
}

export class RemotePlayer {
  constructor(id, weaponTemplates) {
    this.id = id;
    this.weaponTemplates = weaponTemplates;
    this.group = new THREE.Group();
    this.bodyMaterial = buildBodyMaterial();
    this._buildRig();

    this.position = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.targetQuaternion = new THREE.Quaternion();
    this.weaponId = null;
    this.weaponState = null;

    this.highlightTimeout = null;
  }

  _buildRig() {
    const base = new THREE.Group();
    base.position.y = -1.6;
    this.group.add(base);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.4), this.bodyMaterial);
    torso.position.y = 1.2;
    base.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0xded7c3, roughness: 0.6 })
    );
    head.position.y = 1.9;
    base.add(head);

    const leftArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.7, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x4e5048, roughness: 0.6 })
    );
    leftArm.position.set(-0.45, 1.2, 0);
    leftArm.rotation.z = Math.PI / 10;
    base.add(leftArm);

    const rightArm = leftArm.clone();
    rightArm.position.x = 0.45;
    rightArm.rotation.z = -Math.PI / 10;
    base.add(rightArm);

    this.weaponHolder = new THREE.Group();
    this.weaponHolder.position.set(0.35, 1.25, -0.35);
    base.add(this.weaponHolder);
    this._setWeaponModel(null);
  }

  _setWeaponModel(weaponId) {
    if (this.weaponMesh) {
      this.weaponHolder.remove(this.weaponMesh);
      this.weaponMesh.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose?.();
          child.material.dispose?.();
        }
      });
    }
    this.weaponId = weaponId;
    const template = weaponId ? this.weaponTemplates[weaponId] : null;
    this.weaponMesh = buildWeaponModel(template || { slot: 'melee', magazineSize: 1 });
    this.weaponHolder.add(this.weaponMesh);
  }

  refreshWeaponModel() {
    this._setWeaponModel(this.weaponId);
  }

  dispose(scene) {
    scene.remove(this.group);
    clearTimeout(this.highlightTimeout);
  }

  setSnapshot(snapshot) {
    if (!snapshot || !snapshot.position || !snapshot.quaternion) {
      return;
    }
    this.targetPosition.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
    this.targetQuaternion.set(snapshot.quaternion.x, snapshot.quaternion.y, snapshot.quaternion.z, snapshot.quaternion.w);
    if (this.position.distanceToSquared(this.targetPosition) > SNAP_DISTANCE_SQ) {
      this.position.copy(this.targetPosition);
      this.group.position.copy(this.position);
    }
    if (1 - Math.abs(this.quaternion.dot(this.targetQuaternion)) > 0.25) {
      this.quaternion.copy(this.targetQuaternion);
      this.group.quaternion.copy(this.quaternion);
    }

    if (snapshot.activeSlot && snapshot.inventory) {
      const active = snapshot.inventory[snapshot.activeSlot];
      if (active && active.id !== this.weaponId) {
        this._setWeaponModel(active.id);
      }
      this.weaponState = active;
    }
  }

  highlight(headshot) {
    clearTimeout(this.highlightTimeout);
    this.bodyMaterial.color.setHex(headshot ? 0xad3a3a : 0x6fa2d9);
    this.highlightTimeout = setTimeout(() => {
      this.bodyMaterial.color.setHex(0x6d7064);
    }, 320);
  }

  setRespawn(position) {
    if (!position) {
      return;
    }
    this.position.set(position.x, position.y, position.z);
    this.targetPosition.copy(this.position);
    this.group.position.copy(this.position);
  }

  update(delta) {
    const alpha = 1 - Math.exp(-SMOOTHING * delta);
    if (alpha > 0) {
      this.position.lerp(this.targetPosition, alpha);
      this.quaternion.slerp(this.targetQuaternion, alpha);
    }
    this.group.position.copy(this.position);
    this.group.quaternion.copy(this.quaternion);

    if (this.weaponHolder && this.weaponState) {
      const reloading = Boolean(this.weaponState.reloading);
      const reloadPhase = reloading ? 1 : 0;
      const aimPitch = this._extractPitch(this.quaternion);
      this.weaponHolder.rotation.x = THREE.MathUtils.lerp(
        this.weaponHolder.rotation.x,
        THREE.MathUtils.degToRad(-8 * reloadPhase + aimPitch * 0.3),
        0.2
      );
      this.weaponHolder.rotation.z = THREE.MathUtils.lerp(
        this.weaponHolder.rotation.z,
        THREE.MathUtils.degToRad(reloading ? 6 : 0),
        0.25
      );
    }
  }

  _extractPitch(quaternion) {
    const euler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
    return THREE.MathUtils.clamp(euler.x, -Math.PI / 4, Math.PI / 4);
  }
}
