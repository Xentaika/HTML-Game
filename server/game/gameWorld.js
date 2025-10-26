const fs = require('fs');
const path = require('path');
const { Player } = require('../entities/player');
const { ArenaCollider } = require('./arenaCollider');
const { normalize, distancePointToLine } = require('../util/math');
const { WEAPON_TEMPLATES } = require('../config/weaponTemplates');

const ARENA_PATH = path.join(__dirname, '..', '..', 'shared', 'arena.json');
const KILL_REWARD = 300;

function loadArenaConfig() {
  const raw = fs.readFileSync(ARENA_PATH, 'utf-8');
  return JSON.parse(raw);
}

class GameWorld {
  constructor(config) {
    this.config = config;
    this.tick = 0;
    this.players = new Map();
    this.arena = loadArenaConfig();
    this.buyZones = (this.arena.buyZones || []).map((zone) => ({
      center: { x: zone.center[0], y: zone.center[1], z: zone.center[2] },
      radius: zone.radius
    }));
    this.colliders = [];
    const colliderDefs = [...(this.arena.colliders || []), ...(this.arena.cover || [])];
    colliderDefs.forEach((def) => {
      this.colliders.push(
        new ArenaCollider(
          { x: def.position[0], y: def.position[1], z: def.position[2] },
          { x: def.scale[0], y: def.scale[1], z: def.scale[2] }
        )
      );
    });

    this.respawnPoints = [
      { x: 6, y: config.groundLevel, z: 4 },
      { x: -6, y: config.groundLevel, z: 4 },
      { x: 4, y: config.groundLevel, z: -4 },
      { x: -4, y: config.groundLevel, z: -4 },
      { x: 10, y: config.groundLevel, z: 0 },
      { x: -10, y: config.groundLevel, z: 0 }
    ];
  }

  getWeaponCatalog() {
    return WEAPON_TEMPLATES;
  }

  getRandomRespawn() {
    return this.respawnPoints[Math.floor(Math.random() * this.respawnPoints.length)];
  }

  addPlayer(id) {
    const spawn = this.getRandomRespawn();
    const player = new Player(id, spawn, this.config);
    this.players.set(id, player);
    return player;
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  updatePlayerInput(id, input) {
    const player = this.players.get(id);
    if (!player) {
      return;
    }
    player.applyInput(input);
  }

  updatePlayerQuaternion(id, quaternion) {
    const player = this.players.get(id);
    if (!player) {
      return;
    }
    player.updateQuaternion(quaternion);
  }

  handleWeaponSwitch(id, slot) {
    const player = this.players.get(id);
    if (!player) {
      return false;
    }
    if (slot === 'sniper') {
      slot = 'primary';
    }
    return player.equip(slot);
  }

  handlePurchase(id, weaponId) {
    const player = this.players.get(id);
    if (!player) {
      return { success: false, reason: 'unknown_player' };
    }
    try {
      return player.tryPurchase(weaponId);
    } catch (err) {
      return { success: false, reason: 'invalid_weapon' };
    }
  }

  step() {
    const now = Date.now() / 1000;
    this.players.forEach((player) => {
      if (player.weapon && typeof player.weapon.update === 'function') {
        player.weapon.update(now);
      }
      player.integrate(this.config, this.colliders);
      player.inBuyZone = this.isInBuyZone(player.position);
    });
    this.tick += 1;
  }

  isInBuyZone(position) {
    return this.buyZones.some((zone) => {
      const dx = position.x - zone.center.x;
      const dz = position.z - zone.center.z;
      const distanceSq = dx * dx + dz * dz;
      return distanceSq <= zone.radius * zone.radius;
    });
  }

  serializePlayers() {
    return Array.from(this.players.values()).map((player) => player.toSnapshot());
  }

  getSnapshot() {
    return {
      tick: this.tick,
      time: Date.now() / 1000,
      players: this.serializePlayers()
    };
  }

  applyDamage(target, amount) {
    target.health = Math.max(0, target.health - amount);
  }

  respawn(target) {
    const spawn = this.getRandomRespawn();
    target.resetForRespawn(spawn);
    return spawn;
  }

  requestReload(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.weapon || typeof player.weapon.startReload !== 'function') {
      return false;
    }
    const now = Date.now() / 1000;
    return player.weapon.startReload(now);
  }

  registerHit(shooterId) {
    const shooter = this.players.get(shooterId);
    if (!shooter || shooter.health <= 0) {
      return null;
    }

    const now = Date.now() / 1000;
    const shot = shooter.prepareShot(now);
    if (!shot) {
      return null;
    }

    const { origin, direction, weapon } = shot;
    const dir = normalize(direction);
    if (dir.x === 0 && dir.y === 0 && dir.z === 0) {
      return null;
    }
    const maxDistance = weapon.range || 80;
    let bestHit = null;

    this.players.forEach((target, targetId) => {
      if (targetId === shooterId || target.health <= 0) {
        return;
      }

      const headCenter = {
        x: target.position.x,
        y: target.position.y + 0.35,
        z: target.position.z
      };
      const bodyCenter = {
        x: target.position.x,
        y: target.position.y - 0.6,
        z: target.position.z
      };

      const headData = distancePointToLine(headCenter, origin, dir);
      const bodyData = distancePointToLine(bodyCenter, origin, dir);

      const withinRange = (data) => data.alongRay > 0 && data.alongRay < maxDistance;

      let damage = 0;
      let headshot = false;
      let along = Infinity;

      if (withinRange(headData) && headData.distance <= 0.35) {
        damage = weapon.headshotDamage;
        headshot = true;
        along = headData.alongRay;
      } else if (withinRange(bodyData) && bodyData.distance <= 0.65) {
        damage = weapon.bodyDamage;
        along = bodyData.alongRay;
      }

      if (weapon.isMelee && withinRange(bodyData) && bodyData.distance <= 1.2) {
        damage = weapon.bodyDamage;
        headshot = false;
        along = bodyData.alongRay;
      }

      if (damage > 0 && (!bestHit || along < bestHit.along)) {
        bestHit = { target, damage, headshot, along };
      }
    });

    if (!bestHit) {
      return null;
    }

    const { target, damage, headshot } = bestHit;
    this.applyDamage(target, damage);

    let respawnPosition = null;
    let newScore = null;

    if (target.health === 0) {
      const killer = this.players.get(shooterId);
      if (killer) {
        killer.score += 1;
        killer.money += KILL_REWARD;
        newScore = killer.score;
      }
      respawnPosition = this.respawn(target);
    }

    return {
      shooterId,
      targetId: target.id,
      damage,
      headshot,
      remaining: target.health,
      respawn: respawnPosition,
      score: newScore
    };
  }
}

module.exports = { GameWorld };
