import {
  ACCELERATION,
  BUY_ZONE_CENTER,
  BUY_ZONE_RADIUS,
  FRICTION,
  GRAVITY,
  JUMP_SPEED,
  MOVEMENT_SPEED,
  SERVER_SIMULATION_STEP,
  TICK_RATE
} from '../../shared/constants.js';

export const ServerConfig = {
  tickRate: TICK_RATE,
  fixedDelta: SERVER_SIMULATION_STEP,
  movementSpeed: MOVEMENT_SPEED,
  acceleration: ACCELERATION,
  friction: FRICTION,
  gravity: GRAVITY,
  jumpSpeed: JUMP_SPEED,
  buyZone: {
    center: BUY_ZONE_CENTER,
    radius: BUY_ZONE_RADIUS
  }
};
