const { Player } = require('../entities/player');
const { ArenaCollider } = require('./arenaCollider');
const { normalize, distancePointToLine } = require('../util/math');
const { WEAPON_PRESETS } = require('../config/weaponPresets');

const BUY_REWARD_KILL = 300;

class GameWorld {
  constructor(config) {
    this.config = config;
    this.tick = 0;
    this.players = new Map();
    this.respawnPoints = [
      { x: 0, y: config.groundLevel, z: 0 },
      { x: 10, y: config.groundLevel, z: -5 },
      { x: -8, y: config.groundLevel, z: 4 },
      { x: 6, y: config.groundLevel, z: 10 },
      { x: -5, y: config.groundLevel, z: -12 }
    ];
    this.colliders = [
      new ArenaCollider({ x: 0, y: 2, z: -12 }, { x: 4, y: 4, z: 4 }),
      new ArenaCollider({ x: -10, y: 1.2, z: 6 }, { x: 6, y: 2.4, z: 4 }),
      new ArenaCollider({ x: 12, y: 3, z: 10 }, { x: 4, y: 6, z: 4 }),
      new ArenaCollider({ x: -14, y: 2.5, z: -8 }, { x: 5, y: 5, z: 5 })
    ];
    this.buyZones = [
      { position: { x: 0, y: config.groundLevel, z: 0 }, radius: 6 },
      { position: { x: 10, y: config.groundLevel, z: -5 }, radius: 5 }
    ];
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

  updatePlayerQuaternion(id, quaternion, pitch) {
    const player = this.players.get(id);
    if (!player) {
      return;
    }
    player.updateQuaternion(quaternion, pitch);
  }

  isInBuyZone(player) {
    if (!player) {
      return false;
    }
    return this.buyZones.some(({ position, radius }) => {
      const dx = player.position.x - position.x;
      const dz = player.position.z - position.z;
      return Math.hypot(dx, dz) <= radius + 0.2;
    });
  }

  handleBuyRequest(id, weaponId) {
    const player = this.players.get(id);
    if (!player) {
      return { ok: false, reason: 'not_found' };
    }
    const preset = WEAPON_PRESETS[weaponId];
    if (!preset) {
      return { ok: false, reason: 'unknown_weapon' };
    }
    if (!this.isInBuyZone(player)) {
      return { ok: false, reason: 'not_in_zone' };
    }
    if (player.cash < preset.price) {
      return { ok: false, reason: 'not_enough_cash' };
    }

    player.cash -= preset.price;
    player.giveWeapon(weaponId, { equip: true });

    return {
      ok: true,
      cash: player.cash,
      activeSlot: player.activeSlot,
      weapon: player.weapon ? player.weapon.toState() : null,
      inventory: player.toInventoryState()
    };
  }

  handleSwitchRequest(id, slot) {
    const player = this.players.get(id);
    if (!player) {
      return { ok: false, reason: 'not_found' };
    }
    if (!slot || !player.hasWeaponSlot(slot)) {
      return { ok: false, reason: 'no_weapon' };
    }
    player.equipSlot(slot);
    return {
      ok: true,
      activeSlot: player.activeSlot,
      weapon: player.weapon ? player.weapon.toState() : null
    };
  }

  step() {
    const now = Date.now() / 1000;
    this.players.forEach((player) => {
      if (player.weapon && typeof player.weapon.update === 'function') {
        player.weapon.update(now);
      }
      player.integrate(this.config, this.colliders);
    });
    this.tick += 1;
  }

  serializePlayers() {
    return Array.from(this.players.values()).map((player) => player.toSnapshot());
  }

  getSnapshot() {
    return {
      tick: this.tick,
      time: Date.now() / 1000,
      players: this.serializePlayers(),
      buyZones: this.buyZones
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

  registerShot(shooterId) {
    const shooter = this.players.get(shooterId);
    if (!shooter) {
      return null;
    }

    const now = Date.now() / 1000;
    const shot = shooter.prepareShot(now);
    if (!shot) {
      return null;
    }

    const { origin, direction, weapon } = shot;
    const dir = normalize(direction);
    let bestHit = null;

    if (weapon.slot === 'melee') {
      this.players.forEach((target, targetId) => {
        if (targetId === shooterId || target.health <= 0) {
          return;
        }
        const dx = target.position.x - shooter.position.x;
        const dz = target.position.z - shooter.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance <= weapon.range) {
          const damage = weapon.bodyDamage;
          if (!bestHit || distance < bestHit.distance) {
            bestHit = {
              target,
              damage,
              headshot: false,
              distance
            };
          }
        }
      });
    } else {
      if (dir.x === 0 && dir.y === 0 && dir.z === 0) {
        return { shot: { shooterId, weapon: weapon.toState() } };
      }

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

        const withinRange = (data) => data.alongRay > 0 && data.alongRay < weapon.range;

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

        if (damage > 0 && (!bestHit || along < bestHit.along)) {
          bestHit = { target, damage, headshot, along };
        }
      });
    }

    let hitResult = null;

    if (bestHit) {
      const { target, damage, headshot } = bestHit;
      this.applyDamage(target, damage);
      let respawnPosition = null;
      let newScore = null;
      let killerCash = null;

      if (target.health === 0) {
        const killer = this.players.get(shooterId);
        if (killer) {
          killer.score += 1;
          killer.cash += BUY_REWARD_KILL;
          newScore = killer.score;
          killerCash = killer.cash;
        }
        respawnPosition = this.respawn(target);
      }

      hitResult = {
        shooterId,
        targetId: target.id,
        damage,
        headshot,
        remaining: target.health,
        respawn: respawnPosition,
        score: newScore,
        cash: killerCash
      };
    }

    return {
      shot: {
        shooterId,
        weapon: shooter.weapon ? shooter.weapon.toState() : null
      },
      hit: hitResult
    };
  }
}

module.exports = { GameWorld };
