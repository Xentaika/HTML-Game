import * as THREE from 'three';
import { createWeaponState } from './Weapon.js';
import { MOVEMENT_CONFIG } from '../config/movementConfig.js';
import { resolveCollisions } from '../scenes/ArenaCollision.js';

const APPROACH = (current, target, maxDelta) => {
  if (current < target) {
    return Math.min(current + maxDelta, target);
  }
  if (current > target) {
    return Math.max(current - maxDelta, target);
  }
  return target;
};

export class LocalPlayer {
  constructor(controls) {
    this.controls = controls;
    this.object = controls.getObject();
    this.id = null;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.health = 100;
    this.score = 0;
    this.wallet = 0;
    this.inBuyZone = false;
    this.onGround = true;
    this.pendingInputs = [];
    this.weapons = new Map();
    this.activeWeaponId = null;
    this.lastProcessedInput = 0;
    this.viewPitch = 0;
    this.stepTime = 0;
  }

  spawnAt(position) {
    if (!position) {
      return;
    }
    this.position.set(position.x, position.y, position.z);
    this.object.position.copy(this.position);
    this.velocity.set(0, 0, 0);
  }

  ensureWeapon(weaponId) {
    if (!weaponId) {
      return null;
    }
    if (!this.weapons.has(weaponId)) {
      this.weapons.set(weaponId, createWeaponState(weaponId));
    }
    return this.weapons.get(weaponId);
  }

  applySnapshot(snapshot) {
    if (!snapshot) {
      return;
    }
    this.id = snapshot.id ?? this.id;
    if (snapshot.position) {
      this.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
      this.object.position.copy(this.position);
    }
    if (snapshot.velocity) {
      this.velocity.set(snapshot.velocity.x, snapshot.velocity.y, snapshot.velocity.z);
    }
    if (snapshot.health != null) {
      this.health = snapshot.health;
    }
    if (snapshot.score != null) {
      this.score = snapshot.score;
    }
    if (snapshot.wallet != null) {
      this.wallet = snapshot.wallet;
    }
    this.inBuyZone = Boolean(snapshot.inBuyZone);
    if (Array.isArray(snapshot.weapons)) {
      snapshot.weapons.forEach((weaponInfo) => {
        const weapon = this.ensureWeapon(weaponInfo.id);
        if (weapon) {
          weapon.applySnapshot(weaponInfo);
        }
      });
    }
    if (snapshot.activeWeapon) {
      this.activeWeaponId = snapshot.activeWeapon;
    }
    if (typeof snapshot.lastProcessedInput === 'number') {
      this.lastProcessedInput = snapshot.lastProcessedInput;
    }
  }

  getActiveWeapon() {
    if (!this.activeWeaponId) {
      return null;
    }
    return this.weapons.get(this.activeWeaponId) || null;
  }

  getActiveDefinition() {
    const weapon = this.getActiveWeapon();
    if (!weapon) {
      return null;
    }
    return weapon.definition;
  }

  simulateInput(payload, delta, config = MOVEMENT_CONFIG) {
    if (!payload) {
      return;
    }
    const quaternion = payload.quaternion
      ? new THREE.Quaternion(payload.quaternion.x, payload.quaternion.y, payload.quaternion.z, payload.quaternion.w)
      : this.object.quaternion.clone();
    this.object.quaternion.copy(quaternion);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);

    forward.y = 0;
    right.y = 0;

    if (forward.lengthSq() > 0) {
      forward.normalize();
    }
    if (right.lengthSq() > 0) {
      right.normalize();
    }

    const state = payload.state || {};
    const desired = new THREE.Vector3();

    if (state.forward) desired.add(forward);
    if (state.backward) desired.sub(forward);
    if (state.right) desired.add(right);
    if (state.left) desired.sub(right);

    if (desired.lengthSq() > 0) {
      desired.normalize();
    }

    const targetSpeed = state.walk ? config.walkSpeed : config.runSpeed;
    const targetX = desired.x * targetSpeed;
    const targetZ = desired.z * targetSpeed;

    this.velocity.x = APPROACH(this.velocity.x, targetX, config.acceleration * delta);
    this.velocity.z = APPROACH(this.velocity.z, targetZ, config.acceleration * delta);

    if (desired.lengthSq() === 0) {
      this.velocity.x = APPROACH(this.velocity.x, 0, config.friction * delta);
      this.velocity.z = APPROACH(this.velocity.z, 0, config.friction * delta);
    }

    const speedLimit = state.walk ? config.walkSpeed : config.runSpeed;
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizontalSpeed > speedLimit) {
      const scale = speedLimit / horizontalSpeed;
      this.velocity.x *= scale;
      this.velocity.z *= scale;
    }

    if (state.jump && this.onGround) {
      this.velocity.y = config.jumpForce;
      this.onGround = false;
    }

    this.velocity.y -= config.gravity * delta;

    const previous = this.position.clone();
    this.position.x += this.velocity.x * delta;
    this.position.y += this.velocity.y * delta;
    this.position.z += this.velocity.z * delta;

    resolveCollisions(this.position, previous, this.velocity, config.playerHeight, config.playerRadius);

    if (this.position.y < config.groundLevel) {
      this.position.y = config.groundLevel;
      if (this.velocity.y < 0) {
        this.velocity.y = 0;
      }
      this.onGround = true;
    }

    this.object.position.copy(this.position);
  }

  reconcile(serverState, pendingInputs, config = MOVEMENT_CONFIG) {
    this.applySnapshot(serverState);
    const inputsToReplay = pendingInputs.filter((input) => input.sequence > this.lastProcessedInput);
    if (inputsToReplay.length === 0) {
      return;
    }
    inputsToReplay.forEach((input) => {
      this.simulateInput(input.payload, input.delta, config);
    });
  }
}
