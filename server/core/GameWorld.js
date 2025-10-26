import { ArenaLayout } from '../config/arenaConfig.js';
import { ServerConfig } from '../config/serverConfig.js';
import { PlayerState } from '../entities/PlayerState.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { add, normalize, scale, raySphereIntersection, rayVerticalCylinderIntersection } from './math.js';
import { KILL_REWARD, PLAYER_EYE_HEIGHT, PLAYER_HEIGHT, PLAYER_RADIUS } from '../../shared/constants.js';
import { WeaponDefinitions } from '../../shared/weapons.js';

export class GameWorld {
  constructor() {
    this.config = ServerConfig;
    this.arena = ArenaLayout;
    this.players = new Map();
    this.tick = 0;
    this.time = Date.now();
    this.movement = new MovementSystem(this.config, this.arena);
  }

  addPlayer(id) {
    const spawn = this.pickSpawn();
    const player = new PlayerState(id, spawn);
    this.players.set(id, player);
    player.setBuyZoneState(Date.now());
    return player;
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  pickSpawn() {
    const respawns = this.arena.respawns;
    return respawns[Math.floor(Math.random() * respawns.length)] ?? { x: 0, y: 0, z: 0 };
  }

  enqueueInput(id, input) {
    const player = this.players.get(id);
    if (!player) {
      return;
    }
    player.enqueueInput(input);
  }

  requestReload(id, time) {
    const player = this.players.get(id);
    if (!player) {
      return false;
    }
    return player.startReload(time);
  }

  requestWeaponSwitch(id, weaponId) {
    const player = this.players.get(id);
    if (!player) {
      return false;
    }
    return player.cycleWeapon(weaponId);
  }

  requestBuy(id, weaponId) {
    const player = this.players.get(id);
    if (!player) {
      return { success: false, reason: 'no-player' };
    }
    if (!player.isInBuyZone) {
      return { success: false, reason: 'outside-zone' };
    }
    if (player.hasWeapon(weaponId)) {
      return { success: false, reason: 'already-owned' };
    }
    const definition = WeaponDefinitions[weaponId];
    if (!definition) {
      return { success: false, reason: 'unknown-weapon' };
    }
    if (player.money < definition.price) {
      return { success: false, reason: 'no-money' };
    }
    player.grantWeapon(weaponId);
    return { success: true, weaponId, money: player.money };
  }

  attemptShot(id, time) {
    const shooter = this.players.get(id);
    if (!shooter || !shooter.isAlive) {
      return null;
    }
    const weapon = shooter.getActiveWeapon();
    if (!weapon) {
      return null;
    }
    if (!weapon.shoot(time)) {
      return null;
    }

    const definition = weapon.definition;
    const origin = {
      x: shooter.position.x,
      y: shooter.position.y + PLAYER_EYE_HEIGHT,
      z: shooter.position.z
    };

    const cosPitch = Math.cos(shooter.orientation.pitch);
    const direction = normalize({
      x: Math.sin(shooter.orientation.yaw) * cosPitch,
      y: Math.sin(shooter.orientation.pitch),
      z: -Math.cos(shooter.orientation.yaw) * cosPitch
    });

    const maxDistance = definition.range ?? 100;
    let bestHit = null;

    this.players.forEach((target, targetId) => {
      if (targetId === id || !target.isAlive) {
        return;
      }
      const result = this.computeHit(origin, direction, maxDistance, definition, target);
      if (result && (!bestHit || result.distance < bestHit.distance)) {
        bestHit = { ...result, target };
      }
    });

    if (!bestHit) {
      return {
        shooterId: id,
        weaponId: weapon.weaponId,
        fired: true,
        hit: false
      };
    }

    const lethal = bestHit.target.takeDamage(bestHit.damage);
    if (lethal) {
      bestHit.target.scheduleRespawn();
      shooter.kills += 1;
      shooter.score += 1;
      shooter.money += KILL_REWARD;
    }

    return {
      shooterId: id,
      weaponId: weapon.weaponId,
      hit: true,
      targetId: bestHit.target.id,
      damage: bestHit.damage,
      headshot: bestHit.headshot,
      remaining: bestHit.target.health,
      lethal,
      distance: bestHit.distance,
      hitbox: bestHit.hitbox,
      point: bestHit.point
    };
  }

  computeHit(origin, direction, maxDistance, definition, target) {
    const bodyRadius = PLAYER_RADIUS * 0.9;
    const bodyMinY = target.position.y;
    const bodyMaxY = target.position.y + PLAYER_HEIGHT - 0.32;
    const headCenter = {
      x: target.position.x,
      y: target.position.y + PLAYER_HEIGHT - 0.18,
      z: target.position.z
    };
    const headRadius = PLAYER_RADIUS * 0.6;

    const headDistance = raySphereIntersection(origin, direction, headCenter, headRadius);
    const bodyDistance = rayVerticalCylinderIntersection(
      origin,
      direction,
      { x: target.position.x, z: target.position.z },
      bodyRadius,
      bodyMinY + 0.05,
      bodyMaxY
    );

    let distance = null;
    let hitbox = null;

    if (headDistance != null && headDistance > 0 && headDistance <= maxDistance) {
      distance = headDistance;
      hitbox = 'head';
    }

    if (bodyDistance != null && bodyDistance > 0 && bodyDistance <= maxDistance) {
      if (distance == null || bodyDistance < distance) {
        distance = bodyDistance;
        hitbox = 'body';
      }
    }

    if (distance == null) {
      return null;
    }

    const hitPoint = add(origin, scale(direction, distance));
    let damage = definition.damage;
    let headshot = false;

    if (hitbox === 'head') {
      damage = Math.round(definition.damage * definition.headshotMultiplier);
      headshot = true;
    } else {
      const limbThreshold = target.position.y + PLAYER_HEIGHT * 0.45;
      if (hitPoint.y < limbThreshold) {
        damage = Math.round(definition.damage * 0.8);
      }
    }

    return {
      damage,
      headshot,
      distance,
      hitbox,
      point: hitPoint
    };
  }

  step() {
    const now = Date.now();
    const dt = this.config.fixedDelta;
    this.time = now;

    this.players.forEach((player) => {
      player.setBuyZoneState(now);
      player.updateWeaponTimers(now / 1000);
      if (player.updateRespawn(dt, this.arena.respawns)) {
        player.setBuyZoneState(now);
      }
      if (!player.isAlive) {
        return;
      }
      const input = player.consumeInput();
      this.movement.simulate(player, input, dt);
    });

    this.tick += 1;
  }

  getSnapshot() {
    const now = Date.now();
    return {
      tick: this.tick,
      time: now,
      players: Array.from(this.players.values()).map((player) => player.toSnapshot(now)),
      config: {
        tickRate: this.config.tickRate
      }
    };
  }
}
