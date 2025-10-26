import * as THREE from 'three';
import { Weapon } from './Weapon.js';

const POSITION_SMOOTHING = 14;
const VELOCITY_SMOOTHING = 20;
const SNAP_DISTANCE_SQ = 36;
const MIN_LEAD = 0.02;
const MAX_LEAD = 0.12;

export class LocalPlayer {
  constructor(controls) {
    this.id = null;
    this.position = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.serverPosition = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.serverVelocity = new THREE.Vector3();
    this.correction = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.health = 100;
    this.score = 0;
    this.weapon = new Weapon();
    this.controls = controls;
    this.predictionLead = 0.06;
  }

  spawnAt(position) {
    if (!position) {
      return;
    }
    this.position.set(position.x, position.y, position.z);
    this.targetPosition.copy(this.position);
    this.serverPosition.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.serverVelocity.set(0, 0, 0);
    const object = this.controls.getObject();
    object.position.copy(this.position);
  }

  setPredictionLead(lead) {
    if (typeof lead !== 'number' || !Number.isFinite(lead)) {
      return;
    }
    this.predictionLead = Math.min(MAX_LEAD, Math.max(MIN_LEAD, lead));
  }

  applySnapshot(info) {
    if (!info || !info.position || !info.quaternion) {
      return;
    }

    if (info.velocity) {
      this.serverVelocity.set(info.velocity.x || 0, info.velocity.y || 0, info.velocity.z || 0);
    }

    this.serverPosition.set(info.position.x, info.position.y, info.position.z);
    this.targetPosition.copy(this.serverPosition).addScaledVector(this.serverVelocity, this.predictionLead);

    if (this.position.distanceToSquared(this.targetPosition) > SNAP_DISTANCE_SQ) {
      this.position.copy(this.targetPosition);
      this.velocity.copy(this.serverVelocity);
      this.controls.getObject().position.copy(this.position);
    }

    this.quaternion
      .set(info.quaternion.x, info.quaternion.y, info.quaternion.z, info.quaternion.w)
      .normalize();
  }

  update(delta) {
    if (delta <= 0) {
      return;
    }

    const velocityAlpha = 1 - Math.exp(-VELOCITY_SMOOTHING * delta);
    const positionAlpha = 1 - Math.exp(-POSITION_SMOOTHING * delta);

    this.velocity.lerp(this.serverVelocity, velocityAlpha);
    this.position.addScaledVector(this.velocity, delta);

    this.correction.subVectors(this.targetPosition, this.position);
    this.position.addScaledVector(this.correction, positionAlpha);

    this.controls.getObject().position.copy(this.position);
  }

  resetOnRespawn(position) {
    this.weapon.reset();
    this.health = 100;
    this.spawnAt(position);
  }
}
