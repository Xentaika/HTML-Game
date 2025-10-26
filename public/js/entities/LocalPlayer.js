import * as THREE from 'three';
import { MOVEMENT_CONFIG } from '../config/movementConfig.js';
import { WeaponState } from './Weapon.js';
import { FirstPersonRig } from './FirstPersonRig.js';
import { DEFAULT_LOADOUT } from '../config/weaponPresets.js';

const SNAP_DISTANCE_SQ = 36;

export class LocalPlayer {
  constructor(controls, camera) {
    this.controls = controls;
    this.camera = camera;
    this.id = null;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.pitch = 0;
    this.health = 100;
    this.armor = 0;
    this.score = 0;
    this.cash = 1000;
    this.inventory = new Map();
    this.activeSlot = 'secondary';
    this.weapon = new WeaponState(DEFAULT_LOADOUT[1]);
    this.pendingInputs = [];
    this.lastServerSequence = 0;
    this.onGround = true;

    this.predictedPosition = this.position.clone();
    this.predictedVelocity = this.velocity.clone();

    this.rig = new FirstPersonRig(camera);
  }

  dispose() {
    this.rig.dispose();
  }

  syncInventory(inventory) {
    if (!inventory) {
      return;
    }
    Object.entries(inventory).forEach(([slot, state]) => {
      if (!state || !state.id) {
        return;
      }
      if (!this.inventory.has(slot)) {
        this.inventory.set(slot, new WeaponState(state.id));
      }
      this.inventory.get(slot).updateFromServer(state);
    });
    if (this.inventory.has(this.activeSlot)) {
      this.weapon = this.inventory.get(this.activeSlot);
      this.rig.setWeapon(this.weapon.id);
    }
  }

  spawnAt(position) {
    if (!position) {
      return;
    }
    this.position.set(position.x, position.y, position.z);
    this.predictedPosition.copy(this.position);
    const object = this.controls.getObject();
    object.position.copy(this.position);
  }

  resetOnRespawn(position) {
    this.pendingInputs = [];
    this.velocity.set(0, 0, 0);
    this.predictedVelocity.set(0, 0, 0);
    this.onGround = true;
    this.spawnAt(position);
    if (this.weapon) {
      this.weapon.reloading = false;
      this.weapon.reloadEndTime = 0;
    }
  }

  applySnapshot(info, { immediate = false } = {}) {
    if (!info || !info.position || !info.quaternion) {
      return;
    }
    const { x, y, z } = info.position;
    const targetPosition = new THREE.Vector3(x, y, z);

    if (immediate || this.position.distanceToSquared(targetPosition) > SNAP_DISTANCE_SQ) {
      this.position.copy(targetPosition);
    } else {
      this.position.lerp(targetPosition, 0.6);
    }
    this.predictedPosition.copy(this.position);

    if (info.velocity) {
      this.velocity.set(info.velocity.x, info.velocity.y, info.velocity.z);
      this.predictedVelocity.copy(this.velocity);
    }

    this.quaternion.set(info.quaternion.x, info.quaternion.y, info.quaternion.z, info.quaternion.w).normalize();
    this.pitch = info.pitch || 0;
    this.health = info.health;
    this.score = info.score ?? this.score;
    this.cash = info.cash ?? this.cash;
    this.activeSlot = info.activeSlot || this.activeSlot;

    if (info.weapon) {
      if (!this.inventory.has(info.activeSlot || this.activeSlot)) {
        this.inventory.set(info.activeSlot || this.activeSlot, new WeaponState(info.weapon.id));
      }
      const active = this.inventory.get(info.activeSlot || this.activeSlot);
      active.updateFromServer(info.weapon);
      this.weapon = active;
      this.rig.setWeapon(active.id);
    }
    this.syncInventory(info.inventory);

    this.controls.getObject().position.copy(this.position);
    this.controls.getObject().quaternion.copy(this.quaternion);

    if (info.lastInputSequence != null) {
      this.lastServerSequence = info.lastInputSequence;
      this.pendingInputs = this.pendingInputs.filter((entry) => entry.sequence > this.lastServerSequence);
      if (this.pendingInputs.length > 0) {
        this.predictedPosition.copy(this.position);
        this.predictedVelocity.copy(this.velocity);
        this.pendingInputs.forEach((entry) => {
          this._simulateInput(entry.payload, entry.delta);
        });
        this.position.copy(this.predictedPosition);
        this.velocity.copy(this.predictedVelocity);
        this.controls.getObject().position.copy(this.position);
      }
    }
  }

  _normalizeQuaternion(q) {
    const quat = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    quat.normalize();
    return quat;
  }

  _simulateInput(payload, delta) {
    const quaternion = payload.quaternion ? this._normalizeQuaternion(payload.quaternion) : this.quaternion.clone();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion).setY(0);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion).setY(0);

    if (forward.lengthSq() > 0) {
      forward.normalize();
    }
    if (right.lengthSq() > 0) {
      right.normalize();
    }

    let desired = new THREE.Vector3();
    if (payload.forward) {
      desired.add(forward);
    }
    if (payload.backward) {
      desired.sub(forward);
    }
    if (payload.right) {
      desired.add(right);
    }
    if (payload.left) {
      desired.sub(right);
    }

    if (desired.lengthSq() > 0) {
      desired.normalize();
    }

    const targetSpeed = payload.walk ? MOVEMENT_CONFIG.walkSpeed : MOVEMENT_CONFIG.runSpeed;
    const targetVelocity = desired.multiplyScalar(targetSpeed);

    this.predictedVelocity.x = this._approach(this.predictedVelocity.x, targetVelocity.x, MOVEMENT_CONFIG.acceleration * delta);
    this.predictedVelocity.z = this._approach(this.predictedVelocity.z, targetVelocity.z, MOVEMENT_CONFIG.acceleration * delta);

    if (desired.lengthSq() === 0) {
      this.predictedVelocity.x = this._approach(this.predictedVelocity.x, 0, MOVEMENT_CONFIG.friction * delta);
      this.predictedVelocity.z = this._approach(this.predictedVelocity.z, 0, MOVEMENT_CONFIG.friction * delta);
    }

    const speedLimit = targetSpeed;
    const horizontalSpeed = Math.hypot(this.predictedVelocity.x, this.predictedVelocity.z);
    if (horizontalSpeed > speedLimit && speedLimit > 0) {
      const scale = speedLimit / horizontalSpeed;
      this.predictedVelocity.x *= scale;
      this.predictedVelocity.z *= scale;
    }

    if (payload.jump && this.onGround) {
      this.predictedVelocity.y = MOVEMENT_CONFIG.jumpForce;
      this.onGround = false;
    }

    this.predictedVelocity.y -= MOVEMENT_CONFIG.gravity * delta;

    this.predictedPosition.x += this.predictedVelocity.x * delta;
    this.predictedPosition.y += this.predictedVelocity.y * delta;
    this.predictedPosition.z += this.predictedVelocity.z * delta;

    if (this.predictedPosition.y < MOVEMENT_CONFIG.groundLevel) {
      this.predictedPosition.y = MOVEMENT_CONFIG.groundLevel;
      if (this.predictedVelocity.y < 0) {
        this.predictedVelocity.y = 0;
      }
      this.onGround = true;
    }

    this.quaternion.copy(quaternion);
    this.pitch = typeof payload.pitch === 'number' ? payload.pitch : this.pitch;
  }

  _approach(current, target, delta) {
    if (current < target) {
      return Math.min(target, current + delta);
    }
    if (current > target) {
      return Math.max(target, current - delta);
    }
    return target;
  }

  applyLocalInput(payload, delta) {
    this.pendingInputs.push({ sequence: payload.sequence, payload: { ...payload }, delta });
    this._simulateInput(payload, delta);
    this.position.copy(this.predictedPosition);
    this.velocity.copy(this.predictedVelocity);
    this.controls.getObject().position.copy(this.position);
  }

  setActiveSlot(slot) {
    if (!slot || !this.inventory.has(slot)) {
      return;
    }
    this.activeSlot = slot;
    this.weapon = this.inventory.get(slot);
    this.rig.setWeapon(this.weapon.id);
  }

  update(delta) {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.rig.update(delta, { speed, pitch: this.pitch });
  }

  handleWeaponUpdate(state) {
    if (!state || !state.id) {
      return;
    }
    if (!this.inventory.has(this.activeSlot)) {
      this.inventory.set(this.activeSlot, new WeaponState(state.id));
    }
    const active = this.inventory.get(this.activeSlot);
    active.updateFromServer(state);
    this.weapon = active;
    this.rig.setWeapon(active.id);
  }

  onFire(now) {
    this.weapon.consumeShot(now);
    this.rig.triggerFire();
  }

  onReload(duration) {
    const now = performance.now() / 1000;
    this.weapon.reloading = true;
    this.weapon.reloadEndTime = now + duration;
    this.rig.triggerReload(duration);
  }
}
