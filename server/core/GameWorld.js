import { ArenaLayout } from '../config/arenaConfig.js';
import { ServerConfig } from '../config/serverConfig.js';
import { PlayerState } from '../entities/PlayerState.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { distancePointToLine, normalize } from './math.js';
import { KILL_REWARD, PLAYER_EYE_HEIGHT, PLAYER_RADIUS } from '../../shared/constants.js';
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

    const pitchFactor = 0.55;
    const direction = normalize({
      x: Math.sin(shooter.orientation.yaw) * Math.cos(shooter.orientation.pitch * pitchFactor),
      y: Math.sin(shooter.orientation.pitch * pitchFactor),
      z: -Math.cos(shooter.orientation.yaw) * Math.cos(shooter.orientation.pitch * pitchFactor)
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
    let respawn = null;
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
      distance: bestHit.distance
    };
  }

  computeHit(origin, direction, maxDistance, definition, target) {
    const toTarget = {
      x: target.position.x - origin.x,
      y: target.position.y + PLAYER_EYE_HEIGHT - origin.y,
      z: target.position.z - origin.z
    };
    const along = toTarget.x * direction.x + toTarget.y * direction.y + toTarget.z * direction.z;
    if (along <= 0 || along > maxDistance) {
      return null;
    }

    const headCenter = {
      x: target.position.x,
      y: target.position.y + PLAYER_EYE_HEIGHT + 0.2,
      z: target.position.z
    };
    const bodyCenter = {
      x: target.position.x,
      y: target.position.y + PLAYER_EYE_HEIGHT - 0.4,
      z: target.position.z
    };

    const headSample = distancePointToLine(headCenter, origin, direction);
    const bodySample = distancePointToLine(bodyCenter, origin, direction);

    const radius = PLAYER_RADIUS + 0.1;
    let damage = 0;
    let headshot = false;
    let distance = maxDistance;

    if (headSample.alongRay > 0 && headSample.alongRay <= maxDistance && headSample.distance <= radius * 0.7) {
      damage = Math.round(definition.damage * definition.headshotMultiplier);
      headshot = true;
      distance = headSample.alongRay;
    } else if (bodySample.alongRay > 0 && bodySample.alongRay <= maxDistance && bodySample.distance <= radius) {
      damage = definition.damage;
      distance = bodySample.alongRay;
    }

    if (damage <= 0) {
      return null;
    }

    return {
      damage,
      headshot,
      distance
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
