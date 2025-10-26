import {
  MOVEMENT_SPEED,
  ACCELERATION,
  FRICTION,
  GRAVITY,
  JUMP_SPEED,
  PLAYER_RADIUS
} from '/shared/constants.js';

export class MovementSimulator {
  constructor(arena) {
    this.arena = arena;
  }

  simulate(state, input, dt) {
    const velocity = state.velocity;
    const position = state.position;

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

    const wish = {
      x: forward.x * input.forward + right.x * input.right,
      z: forward.z * input.forward + right.z * input.right
    };

    const wishLen = Math.hypot(wish.x, wish.z);
    if (wishLen > 0) {
      wish.x /= wishLen;
      wish.z /= wishLen;
    }

    const wishSpeed = MOVEMENT_SPEED.walk;
    const targetVel = {
      x: wish.x * wishSpeed,
      y: velocity.y,
      z: wish.z * wishSpeed
    };

    velocity.x = this.applyFriction(velocity.x, targetVel.x, dt);
    velocity.z = this.applyFriction(velocity.z, targetVel.z, dt);

    const accel = state.onGround ? ACCELERATION.ground : ACCELERATION.air;
    velocity.x = this.accelerate(velocity.x, targetVel.x, accel, dt);
    velocity.z = this.accelerate(velocity.z, targetVel.z, accel, dt);

    if (state.onGround && input.jump) {
      velocity.y = JUMP_SPEED;
      state.onGround = false;
    } else {
      velocity.y += GRAVITY * dt;
    }

    position.x += velocity.x * dt;
    position.y += velocity.y * dt;
    position.z += velocity.z * dt;

    if (position.y <= this.arena.groundLevel) {
      position.y = this.arena.groundLevel;
      velocity.y = 0;
      state.onGround = true;
    }

    const bounds = this.arena.bounds;
    position.x = Math.max(bounds.min.x + PLAYER_RADIUS, Math.min(bounds.max.x - PLAYER_RADIUS, position.x));
    position.z = Math.max(bounds.min.z + PLAYER_RADIUS, Math.min(bounds.max.z - PLAYER_RADIUS, position.z));

    // obstacle collision is simplified on the client for responsiveness
    this.arena.obstacles.forEach((obstacle) => {
      const halfX = obstacle.size.x / 2 + PLAYER_RADIUS;
      const halfZ = obstacle.size.z / 2 + PLAYER_RADIUS;
      const dx = position.x - obstacle.position.x;
      const dz = position.z - obstacle.position.z;
      if (Math.abs(dx) < halfX && Math.abs(dz) < halfZ) {
        if (halfX - Math.abs(dx) < halfZ - Math.abs(dz)) {
          position.x = obstacle.position.x + Math.sign(dx) * halfX;
          velocity.x = 0;
        } else {
          position.z = obstacle.position.z + Math.sign(dz) * halfZ;
          velocity.z = 0;
        }
      }
    });
  }

  applyFriction(current, target, dt) {
    const diff = current - target;
    const amount = Math.sign(diff) * Math.min(Math.abs(diff), FRICTION * dt);
    return current - amount;
  }

  accelerate(current, target, accel, dt) {
    const delta = target - current;
    const add = accel * dt;
    if (Math.abs(delta) <= add) {
      return target;
    }
    return current + Math.sign(delta) * add;
  }
}
