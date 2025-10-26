import * as THREE from 'three';

const SNAP_DISTANCE_SQ = 25;
const REMOTE_SMOOTHING = 10;

export class RemoteAvatar {
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
    this.targetQuaternion
      .set(snapshot.quaternion.x, snapshot.quaternion.y, snapshot.quaternion.z, snapshot.quaternion.w)
      .normalize();

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
