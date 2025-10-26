import * as THREE from 'three';
import { WeaponInstance } from './Weapon.js';

const ZERO = new THREE.Vector3();
const FORWARD = new THREE.Vector3(0, 0, -1);
const RIGHT = new THREE.Vector3(1, 0, 0);

function approach(current, target, delta) {
  if (current < target) {
    return Math.min(target, current + delta);
  }
  if (current > target) {
    return Math.max(target, current - delta);
  }
  return current;
}

function resolveCollisions(player, previousPosition, colliders, config) {
  const radius = config.playerRadius;
  const height = config.playerHeight;
  const top = player.position.y;
  const bottom = top - height;

  colliders.forEach((collider) => {
    if (top < collider.min.y || bottom > collider.max.y) {
      return;
    }
    const nearestX = Math.max(collider.min.x, Math.min(player.position.x, collider.max.x));
    const nearestZ = Math.max(collider.min.z, Math.min(player.position.z, collider.max.z));
    let deltaX = player.position.x - nearestX;
    let deltaZ = player.position.z - nearestZ;
    let distanceSq = deltaX * deltaX + deltaZ * deltaZ;
    const radiusSq = radius * radius;
    if (distanceSq >= radiusSq) {
      return;
    }
    if (distanceSq === 0) {
      deltaX = player.position.x - previousPosition.x;
      deltaZ = player.position.z - previousPosition.z;
      distanceSq = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSq === 0) {
        deltaX = 1;
        deltaZ = 0;
        distanceSq = 1;
      }
    }
    let distance = Math.sqrt(distanceSq);
    if (distance === 0) {
      distance = 1;
    }
    const penetration = radius - distance;
    const normalX = deltaX / distance;
    const normalZ = deltaZ / distance;
    player.position.x += normalX * penetration;
    player.position.z += normalZ * penetration;
    if ((normalX > 0 && player.velocity.x < 0) || (normalX < 0 && player.velocity.x > 0)) {
      player.velocity.x = 0;
    }
    if ((normalZ > 0 && player.velocity.z < 0) || (normalZ < 0 && player.velocity.z > 0)) {
      player.velocity.z = 0;
    }
  });
}

export class LocalPlayer {
  constructor(controls, config, colliders = []) {
    this.controls = controls;
    this.config = config;
    this.colliders = colliders;
    this.weaponTemplates = {};

    this.id = null;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.health = 100;
    this.money = 800;
    this.score = 0;
    this.inBuyZone = false;

    this.inventory = { melee: null, secondary: null, primary: null };
    this.activeSlot = 'secondary';
    this.weapon = null;
    this.jumpArmed = false;

    this.serverPosition = new THREE.Vector3();
    this.serverVelocity = new THREE.Vector3();
    this.serverQuaternion = new THREE.Quaternion();
    this.lastServerTick = 0;

    this.onGround = true;
  }

  setWeaponTemplates(templates) {
    this.weaponTemplates = templates || {};
  }

  setColliders(colliders) {
    this.colliders = colliders || [];
  }

  reset(position) {
    this.position.copy(position || ZERO);
    this.velocity.set(0, 0, 0);
    this.quaternion.copy(this.controls.getObject().quaternion);
    this.health = 100;
    this.money = 800;
    this.score = 0;
    this.inBuyZone = false;
    this.inventory = { melee: null, secondary: null, primary: null };
    this.activeSlot = 'secondary';
    this.weapon = null;
  }

  ensureWeapon(slot, id) {
    if (!id) {
      this.inventory[slot] = null;
      return null;
    }
    const template = this.weaponTemplates[id];
    if (!template) {
      return null;
    }
    if (!this.inventory[slot] || this.inventory[slot].id !== id) {
      this.inventory[slot] = new WeaponInstance(id, template);
    }
    if (slot === this.activeSlot) {
      this.weapon = this.inventory[slot];
    }
    return this.inventory[slot];
  }

  applyInventory(inventoryState) {
    if (!inventoryState) {
      return;
    }
    ['melee', 'secondary', 'primary'].forEach((slot) => {
      const state = inventoryState[slot];
      if (!state) {
        this.inventory[slot] = null;
        return;
      }
      const weapon = this.ensureWeapon(slot, state.id);
      if (weapon) {
        weapon.applyNetworkState(state);
      }
    });
    this.weapon = this.inventory[this.activeSlot] || this.inventory.secondary || this.inventory.melee;
  }

  applySnapshot(info) {
    if (!info) {
      return;
    }
    this.health = info.health != null ? info.health : this.health;
    this.money = info.money != null ? info.money : this.money;
    this.score = info.score != null ? info.score : this.score;
    this.inBuyZone = Boolean(info.inBuyZone);
    if (info.activeSlot) {
      this.activeSlot = info.activeSlot;
    }
    this.applyInventory(info.inventory);

    if (info.position) {
      this.serverPosition.set(info.position.x, info.position.y, info.position.z);
      if (this.lastServerTick === 0) {
        this.position.copy(this.serverPosition);
        this.controls.getObject().position.copy(this.position);
      }
    }
    if (info.velocity) {
      this.serverVelocity.set(info.velocity.x, info.velocity.y, info.velocity.z);
    }
    if (info.quaternion) {
      this.serverQuaternion.set(info.quaternion.x, info.quaternion.y, info.quaternion.z, info.quaternion.w);
    }
  }

  setServerTick(tick) {
    if (typeof tick === 'number') {
      this.lastServerTick = tick;
    }
  }

  reconcile(delta) {
    const correctionStrength = Math.min(1, delta * 8);
    this.position.lerp(this.serverPosition, correctionStrength);
    this.velocity.lerp(this.serverVelocity, correctionStrength);
    this.controls.getObject().position.copy(this.position);
  }

  getWeapon() {
    if (!this.weapon) {
      this.weapon = this.inventory[this.activeSlot] || this.inventory.secondary || this.inventory.melee;
    }
    return this.weapon;
  }

  canShoot(now) {
    const weapon = this.getWeapon();
    return weapon ? weapon.canShoot(now) : false;
  }

  shoot(now) {
    const weapon = this.getWeapon();
    if (!weapon) {
      return false;
    }
    return weapon.tryShoot(now);
  }

  startReload(now) {
    const weapon = this.getWeapon();
    if (!weapon) {
      return false;
    }
    return weapon.startReload(now);
  }

  updateReload(now) {
    const weapon = this.getWeapon();
    if (!weapon) {
      return false;
    }
    return weapon.update(now);
  }

  equip(slot) {
    if (!slot) {
      return false;
    }
    if (!this.inventory[slot]) {
      return false;
    }
    if (this.activeSlot === slot) {
      return false;
    }
    this.activeSlot = slot;
    this.weapon = this.inventory[slot];
    return true;
  }

  handleJumpAcknowledged() {
    this.jumpArmed = false;
  }

  simulateMovement(inputState, delta) {
    const camera = this.controls.getObject();
    const forward = FORWARD.clone().applyQuaternion(camera.quaternion);
    const right = RIGHT.clone().applyQuaternion(camera.quaternion);
    forward.y = 0;
    right.y = 0;
    if (forward.lengthSq() > 0) {
      forward.normalize();
    }
    if (right.lengthSq() > 0) {
      right.normalize();
    }

    const desired = new THREE.Vector3();
    if (inputState.forward) {
      desired.add(forward);
    }
    if (inputState.backward) {
      desired.sub(forward);
    }
    if (inputState.right) {
      desired.add(right);
    }
    if (inputState.left) {
      desired.sub(right);
    }
    if (desired.lengthSq() > 0) {
      desired.normalize();
    }

    const modifier = this.getWeapon()?.moveSpeedModifier ?? 1;
    const speed = (inputState.walk ? this.config.walkSpeed : this.config.runSpeed) * modifier;
    const targetX = desired.x * speed;
    const targetZ = desired.z * speed;

    this.velocity.x = approach(this.velocity.x, targetX, this.config.acceleration * delta);
    this.velocity.z = approach(this.velocity.z, targetZ, this.config.acceleration * delta);

    if (desired.lengthSq() === 0) {
      this.velocity.x = approach(this.velocity.x, 0, this.config.friction * delta);
      this.velocity.z = approach(this.velocity.z, 0, this.config.friction * delta);
    }

    const speedLimit = speed;
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizontalSpeed > speedLimit && speedLimit > 0) {
      const scale = speedLimit / horizontalSpeed;
      this.velocity.x *= scale;
      this.velocity.z *= scale;
    }

    if (inputState.jump && !this.jumpArmed && this.onGround) {
      this.velocity.y = this.config.jumpForce;
      this.onGround = false;
      this.jumpArmed = true;
    }

    this.velocity.y -= this.config.gravity * delta;

    const previousPosition = this.position.clone();
    this.position.x += this.velocity.x * delta;
    this.position.y += this.velocity.y * delta;
    this.position.z += this.velocity.z * delta;

    resolveCollisions(this, previousPosition, this.colliders, this.config);
    if (this.position.y < this.config.groundLevel) {
      this.position.y = this.config.groundLevel;
      if (this.velocity.y < 0) {
        this.velocity.y = 0;
      }
      this.onGround = true;
    } else if (this.velocity.y > 0) {
      this.onGround = false;
    }

    camera.position.copy(this.position);
  }

  update(inputState, delta) {
    this.simulateMovement(inputState, delta);
    this.reconcile(delta);
  }
}
