const { MovementInput } = require('./movementInput');
const { approach } = require('../util/math');
const { resolvePlayerCollisions } = require('../game/arenaCollider');
const { Weapon } = require('./weapon');
const { WEAPON_PRESETS, DEFAULT_LOADOUT } = require('../config/weaponPresets');

const createWeapon = (weaponId) => {
  const preset = WEAPON_PRESETS[weaponId];
  if (!preset) {
    return null;
  }
  return new Weapon(preset);
};

class Player {
  constructor(id, spawnPoint, config) {
    this.id = id;
    this.config = config;
    this.position = { ...spawnPoint };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.quaternion = { x: 0, y: 0, z: 0, w: 1 };
    this.pitch = 0;
    this.onGround = true;
    this.input = new MovementInput();
    this.health = 100;
    this.score = 0;
    this.cash = 1000;
    this.inventory = new Map();
    this.activeSlot = 'secondary';
    this.lastUpdate = Date.now();
    this.lastProcessedInput = 0;

    this.initializeLoadout();
    this.spawnPoint = { ...spawnPoint };
  }

  initializeLoadout() {
    this.inventory.clear();
    DEFAULT_LOADOUT.forEach((weaponId) => {
      const instance = createWeapon(weaponId);
      if (instance) {
        this.inventory.set(instance.slot, instance);
      }
    });
    if (!this.inventory.has('melee')) {
      const knife = createWeapon('knife');
      if (knife) {
        this.inventory.set('melee', knife);
      }
    }
    this.equipSlot(this.inventory.has('secondary') ? 'secondary' : 'melee');
  }

  equipSlot(slot) {
    if (!this.inventory.has(slot)) {
      return false;
    }
    this.activeSlot = slot;
    this.weapon = this.inventory.get(slot);
    return true;
  }

  giveWeapon(weaponId, { equip = true } = {}) {
    const instance = createWeapon(weaponId);
    if (!instance) {
      return null;
    }
    this.inventory.set(instance.slot, instance);
    if (equip) {
      this.equipSlot(instance.slot);
    }
    return instance;
  }

  hasWeaponSlot(slot) {
    return this.inventory.has(slot);
  }

  resetForRespawn(spawnPoint) {
    this.position = { ...spawnPoint };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.quaternion = { x: 0, y: 0, z: 0, w: 1 };
    this.pitch = 0;
    this.onGround = true;
    this.input = new MovementInput();
    this.health = 100;
    this.score = this.score;
    this.lastUpdate = Date.now();
    this.inventory.forEach((weapon) => weapon.reset());
    if (!this.inventory.has('melee')) {
      this.giveWeapon('knife', { equip: false });
    }
    if (!this.inventory.has('secondary')) {
      this.giveWeapon('glock18', { equip: false });
    }
    this.equipSlot(this.inventory.has('primary') ? this.activeSlot : 'secondary');
  }

  updateQuaternion(quaternion, pitch = null) {
    if (!quaternion) {
      return;
    }
    const { x, y, z, w } = quaternion;
    const length = Math.hypot(x, y, z, w);
    if (length === 0) {
      return;
    }
    this.quaternion = {
      x: x / length,
      y: y / length,
      z: z / length,
      w: w / length
    };
    if (typeof pitch === 'number') {
      this.pitch = pitch;
    }
  }

  applyInput(payload) {
    this.input.setFromPayload(payload || {});
    this.lastUpdate = Date.now();
    if (payload && typeof payload.pitch === 'number') {
      this.pitch = payload.pitch;
    }
    if (this.input.sequence) {
      this.lastProcessedInput = this.input.sequence;
    }
  }

  applyGroundConstraint() {
    if (this.position.y < this.config.groundLevel) {
      this.position.y = this.config.groundLevel;
      if (this.velocity.y < 0) {
        this.velocity.y = 0;
      }
      this.onGround = true;
    } else if (this.velocity.y > 0) {
      this.onGround = false;
    }
  }

  getForward() {
    const { x: qx, y: qy, z: qz, w: qw } = this.quaternion;
    const ix = qw * 0 + qy * -1 - qz * 0;
    const iy = qw * 0 + qz * 0 - qx * -1;
    const iz = qw * -1 + qx * 0 - qy * 0;
    const iw = -qx * 0 - qy * 0 - qz * -1;

    const x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    const y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    const z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return { x, y, z };
  }

  getRight() {
    const { x: qx, y: qy, z: qz, w: qw } = this.quaternion;
    const ix = qw * 1 + qy * 0 - qz * 0;
    const iy = qw * 0 + qz * 1 - qx * 0;
    const iz = qw * 0 + qx * 0 - qy * 1;
    const iw = -qx * 1 - qy * 0 - qz * 0;

    const x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    const y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    const z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return { x, y, z };
  }

  getShootDirection() {
    const forward = this.getForward();
    const length = Math.hypot(forward.x, forward.y, forward.z);
    if (length === 0) {
      return { x: 0, y: 0, z: -1 };
    }
    return { x: forward.x / length, y: forward.y / length, z: forward.z / length };
  }

  getShootOrigin(direction) {
    const eyeHeight = 0.35;
    return {
      x: this.position.x + direction.x * 0.2,
      y: this.position.y + eyeHeight,
      z: this.position.z + direction.z * 0.2
    };
  }

  prepareShot(time) {
    if (!this.weapon) {
      return null;
    }

    if (typeof this.weapon.update === 'function') {
      this.weapon.update(time);
    }

    if (typeof this.weapon.tryShoot !== 'function' || !this.weapon.tryShoot(time)) {
      return null;
    }

    const direction = this.getShootDirection();
    const origin = this.getShootOrigin(direction);
    return { origin, direction, weapon: this.weapon };
  }

  integrate(config, colliders) {
    const delta = config.fixedDelta;
    const forward = this.getForward();
    const right = this.getRight();

    forward.y = 0;
    right.y = 0;

    const forwardLength = Math.hypot(forward.x, forward.z);
    if (forwardLength > 0) {
      forward.x /= forwardLength;
      forward.z /= forwardLength;
    }

    const rightLength = Math.hypot(right.x, right.z);
    if (rightLength > 0) {
      right.x /= rightLength;
      right.z /= rightLength;
    }

    let desiredX = 0;
    let desiredZ = 0;

    if (this.input.forward) {
      desiredX += forward.x;
      desiredZ += forward.z;
    }
    if (this.input.backward) {
      desiredX -= forward.x;
      desiredZ -= forward.z;
    }
    if (this.input.right) {
      desiredX += right.x;
      desiredZ += right.z;
    }
    if (this.input.left) {
      desiredX -= right.x;
      desiredZ -= right.z;
    }

    const magnitude = Math.hypot(desiredX, desiredZ);
    if (magnitude > 0) {
      desiredX /= magnitude;
      desiredZ /= magnitude;
    }

    const targetSpeed = this.input.walk ? config.walkSpeed : config.runSpeed;
    const targetX = desiredX * targetSpeed;
    const targetZ = desiredZ * targetSpeed;

    this.velocity.x = approach(this.velocity.x, targetX, config.acceleration * delta);
    this.velocity.z = approach(this.velocity.z, targetZ, config.acceleration * delta);

    if (magnitude === 0) {
      this.velocity.x = approach(this.velocity.x, 0, config.friction * delta);
      this.velocity.z = approach(this.velocity.z, 0, config.friction * delta);
    }

    const speedLimit = this.input.walk ? config.walkSpeed : config.runSpeed;
    if (speedLimit > 0) {
      const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      if (horizontalSpeed > speedLimit) {
        const scale = speedLimit / horizontalSpeed;
        this.velocity.x *= scale;
        this.velocity.z *= scale;
      }
    }

    if (this.input.consumeJump() && this.onGround) {
      this.velocity.y = config.jumpForce;
      this.onGround = false;
    }

    this.velocity.y -= config.gravity * delta;

    const previousPosition = { ...this.position };
    this.position.x += this.velocity.x * delta;
    this.position.y += this.velocity.y * delta;
    this.position.z += this.velocity.z * delta;

    resolvePlayerCollisions(this, previousPosition, colliders, config.playerRadius);
    this.applyGroundConstraint();
  }

  toInventoryState() {
    const result = {};
    this.inventory.forEach((weapon, slot) => {
      result[slot] = weapon.toState();
    });
    return result;
  }

  toSnapshot() {
    return {
      id: this.id,
      position: this.position,
      quaternion: this.quaternion,
      pitch: this.pitch,
      velocity: this.velocity,
      health: this.health,
      score: this.score,
      cash: this.cash,
      weapon: this.weapon ? this.weapon.toState() : null,
      inventory: this.toInventoryState(),
      activeSlot: this.activeSlot,
      lastInputSequence: this.lastProcessedInput
    };
  }
}

module.exports = { Player };
