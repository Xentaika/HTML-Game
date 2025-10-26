const { MovementInput } = require('./movementInput');
const { approach } = require('../util/math');
const { resolvePlayerCollisions } = require('../game/arenaCollider');

class Player {
  constructor(id, spawnPoint, config, character) {
    this.id = id;
    this.config = config;
    this.character = character;
    this.position = { ...spawnPoint };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.quaternion = { x: 0, y: 0, z: 0, w: 1 };
    this.onGround = true;
    this.input = new MovementInput();
    this.health = character.maxHealth;
    this.score = 0;
    this.weapon = character.loadout.primary;
    this.lastUpdate = Date.now();

    if (this.weapon && typeof this.weapon.reset === 'function') {
      this.weapon.reset();
    }
  }

  resetForRespawn(spawnPoint) {
    this.position = { ...spawnPoint };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.quaternion = { x: 0, y: 0, z: 0, w: 1 };
    this.onGround = true;
    this.input = new MovementInput();
    this.health = this.character.maxHealth;
    this.weapon = this.character.loadout.primary;
    if (this.weapon && typeof this.weapon.reset === 'function') {
      this.weapon.reset();
    }
  }

  updateQuaternion(quaternion) {
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
  }

  applyInput(payload) {
    this.input.setFromPayload(payload || {});
    this.lastUpdate = Date.now();
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
    return { origin, direction };
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

  toSnapshot() {
    return {
      id: this.id,
      position: this.position,
      quaternion: this.quaternion,
      velocity: this.velocity,
      health: this.health,
      score: this.score
    };
  }
}

module.exports = { Player };
