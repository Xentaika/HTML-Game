import * as THREE from 'three';
import { Weapon } from './Weapon.js';

const LOCAL_SMOOTHING = 18;
const SNAP_DISTANCE_SQ = 25;

export class LocalPlayer {
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
