import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../../shared/constants.js';
import { clampMagnitude, length, scale } from '../core/math.js';

export class MovementSystem {
  constructor(config, arena) {
    this.config = config;
    this.arena = arena;
  }

  simulate(player, input, dt) {
    if (!player.isAlive) {
      player.velocity = { x: 0, y: 0, z: 0 };
      return;
    }

    const forward = {
      x: Math.sin(input.yaw),
      y: 0,
      z: -Math.cos(input.yaw)
    };
    const right = {
      x: Math.cos(input.yaw),
      y: 0,
      z: Math.sin(input.yaw)
    };

    const wishDir = {
      x: forward.x * input.forward + right.x * input.right,
      y: 0,
      z: forward.z * input.forward + right.z * input.right
    };

    let wishSpeed = this.config.movementSpeed.walk;
    const wishDirLen = length(wishDir);
    let wishVel = { x: 0, y: 0, z: 0 };
    if (wishDirLen > 0) {
      const normalized = scale(wishDir, 1 / wishDirLen);
      wishVel = scale(normalized, wishSpeed);
    }

    player.velocity.x = this.applyFriction(player.velocity.x, wishVel.x, dt);
    player.velocity.z = this.applyFriction(player.velocity.z, wishVel.z, dt);

    const accel = player.onGround ? this.config.acceleration.ground : this.config.acceleration.air;
    player.velocity.x = this.accelerate(player.velocity.x, wishVel.x, accel, dt);
    player.velocity.z = this.accelerate(player.velocity.z, wishVel.z, accel, dt);

    if (player.onGround && input.jump) {
      player.velocity.y = this.config.jumpSpeed;
      player.onGround = false;
    } else {
      player.velocity.y += this.config.gravity * dt;
    }

    player.velocity = clampMagnitude(player.velocity, 12);

    const newPosition = {
      x: player.position.x + player.velocity.x * dt,
      y: player.position.y + player.velocity.y * dt,
      z: player.position.z + player.velocity.z * dt
    };

    const resolved = this.resolveCollisions(player.position, newPosition);
    player.position = resolved.position;
    player.velocity = resolved.velocity;
    player.onGround = resolved.onGround;
  }

  applyFriction(current, target, dt) {
    const diff = current - target;
    const frictionAmount = Math.sign(diff) * Math.min(Math.abs(diff), this.config.friction * dt);
    return current - frictionAmount;
  }

  accelerate(current, wish, accel, dt) {
    const delta = wish - current;
    const addSpeed = accel * dt;
    if (Math.abs(delta) <= addSpeed) {
      return wish;
    }
    return current + Math.sign(delta) * addSpeed;
  }

  resolveCollisions(previous, proposed) {
    let position = { ...proposed };
    let velocity = {
      x: (proposed.x - previous.x) / this.config.fixedDelta,
      y: (proposed.y - previous.y) / this.config.fixedDelta,
      z: (proposed.z - previous.z) / this.config.fixedDelta
    };
    let onGround = false;

    if (position.y <= this.arena.groundLevel) {
      position.y = this.arena.groundLevel;
      velocity.y = 0;
      onGround = true;
    }

    const bounds = this.arena.bounds;
    position.x = Math.max(bounds.min.x + PLAYER_RADIUS, Math.min(bounds.max.x - PLAYER_RADIUS, position.x));
    position.z = Math.max(bounds.min.z + PLAYER_RADIUS, Math.min(bounds.max.z - PLAYER_RADIUS, position.z));

    const finalPos = { ...position };
    const finalVel = { ...velocity };

    this.arena.obstacles.forEach((obstacle) => {
      const res = this.resolveAgainstObstacle(finalPos, finalVel, obstacle);
      finalPos.x = res.position.x;
      finalPos.y = res.position.y;
      finalPos.z = res.position.z;
      finalVel.x = res.velocity.x;
      finalVel.y = res.velocity.y;
      finalVel.z = res.velocity.z;
      onGround = onGround || res.onGround;
    });

    return {
      position: finalPos,
      velocity: finalVel,
      onGround
    };
  }

  resolveAgainstObstacle(position, velocity, obstacle) {
    const half = {
      x: obstacle.size.x / 2 + PLAYER_RADIUS,
      y: obstacle.size.y / 2 + PLAYER_HEIGHT,
      z: obstacle.size.z / 2 + PLAYER_RADIUS
    };

    const delta = {
      x: position.x - obstacle.position.x,
      y: position.y + PLAYER_HEIGHT / 2 - obstacle.position.y,
      z: position.z - obstacle.position.z
    };

    const overlap = {
      x: half.x - Math.abs(delta.x),
      y: half.y - Math.abs(delta.y),
      z: half.z - Math.abs(delta.z)
    };

    let onGround = false;
    if (overlap.x > 0 && overlap.y > 0 && overlap.z > 0) {
      if (overlap.y < overlap.x && overlap.y < overlap.z) {
        position.y += Math.sign(delta.y) * overlap.y;
        velocity.y = 0;
        if (delta.y < 0) {
          onGround = true;
        }
      } else if (overlap.x < overlap.z) {
        position.x += Math.sign(delta.x) * overlap.x;
        velocity.x = 0;
      } else {
        position.z += Math.sign(delta.z) * overlap.z;
        velocity.z = 0;
      }
    }

    return {
      position,
      velocity,
      onGround
    };
  }
}
