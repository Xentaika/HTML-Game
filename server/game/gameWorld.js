const { Character } = require('../entities/character');
const { Player } = require('../entities/player');
const { ArenaCollider } = require('./arenaCollider');
const { normalize, distancePointToLine } = require('../util/math');
const { WEAPON_DEFINITIONS } = require('../config/weaponData');

function vectorLength(vec) {
  return Math.hypot(vec.x, vec.y, vec.z);
}

function normalizeSafe(vec) {
  const length = vectorLength(vec);
  if (length === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: vec.x / length, y: vec.y / length, z: vec.z / length };
}

function cross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function addScaled(base, addition, scale) {
  return { x: base.x + addition.x * scale, y: base.y + addition.y * scale, z: base.z + addition.z * scale };
}

function applySpread(direction, spread) {
  if (!spread || spread <= 0) {
    return normalizeSafe(direction);
  }
  const forward = normalizeSafe(direction);
  let up = { x: 0, y: 1, z: 0 };
  if (Math.abs(forward.x) < 0.0001 && Math.abs(forward.z) < 0.0001) {
    up = { x: 1, y: 0, z: 0 };
  }
  let right = cross(forward, up);
  if (vectorLength(right) === 0) {
    right = { x: 1, y: 0, z: 0 };
  }
  right = normalizeSafe(right);
  up = normalizeSafe(cross(right, forward));

  const yaw = (Math.random() - 0.5) * spread;
  const pitch = (Math.random() - 0.5) * spread;

  let dir = addScaled(forward, right, yaw);
  dir = addScaled(dir, up, pitch);
  return normalizeSafe(dir);
}

class GameWorld {
  constructor(config) {
    this.config = config;
    this.tick = 0;
    this.players = new Map();
    this.respawnPoints = [
      { x: 0, y: config.groundLevel, z: 0 },
      { x: 8, y: config.groundLevel, z: -6 },
      { x: -9, y: config.groundLevel, z: 5 },
      { x: 6, y: config.groundLevel, z: 11 },
      { x: -6, y: config.groundLevel, z: -10 }
    ];
    this.colliders = [
      new ArenaCollider({ x: 0, y: 2, z: -12 }, { x: 6, y: 4, z: 4 }),
      new ArenaCollider({ x: -10, y: 1.6, z: 6 }, { x: 8, y: 3, z: 4 }),
      new ArenaCollider({ x: 12, y: 2.8, z: 10 }, { x: 6, y: 5, z: 4 }),
      new ArenaCollider({ x: -14, y: 2.5, z: -8 }, { x: 5, y: 5, z: 5 })
    ];

    this.buyZone = {
      center: { x: 0, y: config.groundLevel, z: 0 },
      radius: 7
    };
  }

  createDefaultCharacter() {
    return new Character({ name: 'Штурмовик', maxHealth: 100, startingWallet: 800, loadout: ['knife', 'glock18'] });
  }

  getRandomRespawn() {
    return this.respawnPoints[Math.floor(Math.random() * this.respawnPoints.length)];
  }

  addPlayer(id) {
    const spawn = this.getRandomRespawn();
    const character = this.createDefaultCharacter();
    const player = new Player(id, spawn, this.config, character);
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

  step() {
    const now = Date.now() / 1000;
    this.players.forEach((player) => {
      player.updateWeapons(now);
      player.integrate(this.config, this.colliders);
      this.updateBuyZoneState(player);
    });
    this.tick += 1;
  }

  updateBuyZoneState(player) {
    const dx = player.position.x - this.buyZone.center.x;
    const dz = player.position.z - this.buyZone.center.z;
    const distanceSq = dx * dx + dz * dz;
    player.setBuyZoneStatus(distanceSq <= this.buyZone.radius * this.buyZone.radius);
  }

  serializePlayers() {
    return Array.from(this.players.values()).map((player) => player.toSnapshot());
  }

  getSnapshot() {
    return {
      tick: this.tick,
      time: Date.now() / 1000,
      players: this.serializePlayers(),
      buyZone: this.buyZone
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
    if (!player) {
      return null;
    }
    const weapon = player.getActiveWeapon();
    if (!weapon) {
      return null;
    }
    const now = Date.now() / 1000;
    const result = weapon.startReload(now);
    if (!result) {
      return null;
    }
    return { weaponId: player.activeWeaponId, endTime: result.endTime };
  }

  handleEquip(playerId, weaponId) {
    const player = this.players.get(playerId);
    if (!player) {
      return { ok: false, reason: 'not_found' };
    }
    if (!player.switchWeapon(weaponId)) {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: true, activeWeapon: player.activeWeaponId, weapons: player.serializeWeapons() };
  }

  handleBuy(playerId, weaponId) {
    const player = this.players.get(playerId);
    if (!player) {
      return { ok: false, reason: 'not_found' };
    }
    if (!player.inBuyZone) {
      return { ok: false, reason: 'zone' };
    }
    const definition = WEAPON_DEFINITIONS[weaponId];
    if (!definition) {
      return { ok: false, reason: 'invalid' };
    }
    if (player.wallet < definition.price) {
      return { ok: false, reason: 'funds' };
    }
    player.wallet -= definition.price;
    player.giveWeapon(weaponId, { equip: true });
    return { ok: true, wallet: player.wallet, activeWeapon: player.activeWeaponId, weapons: player.serializeWeapons() };
  }

  registerHit(shooterId) {
    const shooter = this.players.get(shooterId);
    if (!shooter) {
      return null;
    }
    const prepared = shooter.prepareShot(Date.now() / 1000);
    if (!prepared) {
      return null;
    }

    const { origin, direction, weapon, shot } = prepared;
    const definition = weapon.definition;
    let hitResult = null;

    if (shot.type === 'melee') {
      const forward = normalizeSafe(direction);
      let best = null;
      this.players.forEach((target, id) => {
        if (id === shooterId || target.health <= 0) {
          return;
        }
        const center = {
          x: target.position.x,
          y: target.position.y + 0.9,
          z: target.position.z
        };
        const toTarget = {
          x: center.x - origin.x,
          y: center.y - origin.y,
          z: center.z - origin.z
        };
        const distance = vectorLength(toTarget);
        if (distance > definition.range) {
          return;
        }
        const dir = normalizeSafe(toTarget);
        const alignment = dir.x * forward.x + dir.y * forward.y + dir.z * forward.z;
        if (alignment < 0.4) {
          return;
        }
        if (!best || distance < best.distance) {
          best = { target, distance };
        }
      });
      if (best) {
        this.applyDamage(best.target, definition.bodyDamage);
        let respawnPosition = null;
        let newScore = null;
        if (best.target.health === 0) {
          const killer = this.players.get(shooterId);
          if (killer) {
            killer.score += 1;
            killer.wallet += 300;
            newScore = killer.score;
          }
          respawnPosition = this.respawn(best.target);
        }
        hitResult = {
          targetId: best.target.id,
          damage: definition.bodyDamage,
          headshot: false,
          remaining: best.target.health,
          respawn: respawnPosition,
          score: newScore
        };
      }
    } else {
      const directionWithSpread = applySpread(direction, shot.spread);
      const dir = normalize(directionWithSpread);
      const range = shot.range || definition.range || 80;
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
          y: target.position.y - 0.4,
          z: target.position.z
        };

        const headData = distancePointToLine(headCenter, origin, dir);
        const bodyData = distancePointToLine(bodyCenter, origin, dir);

        const withinRange = (data) => data.alongRay > 0 && data.alongRay <= range;

        let damage = 0;
        let headshot = false;
        let along = Infinity;

        if (withinRange(headData) && headData.distance <= 0.35) {
          damage = definition.headshotDamage;
          headshot = true;
          along = headData.alongRay;
        } else if (withinRange(bodyData) && bodyData.distance <= 0.6) {
          damage = definition.bodyDamage;
          along = bodyData.alongRay;
        }

        if (damage > 0 && (!bestHit || along < bestHit.along)) {
          bestHit = { target, damage, headshot, along };
        }
      });

      if (bestHit) {
        const { target, damage, headshot } = bestHit;
        this.applyDamage(target, damage);
        let respawnPosition = null;
        let newScore = null;
        if (target.health === 0) {
          const killer = this.players.get(shooterId);
          if (killer) {
            killer.score += 1;
            killer.wallet += 300;
            newScore = killer.score;
          }
          respawnPosition = this.respawn(target);
        }
        hitResult = {
          targetId: target.id,
          damage,
          headshot,
          remaining: target.health,
          respawn: respawnPosition,
          score: newScore
        };
      }
    }

    return {
      shooterId,
      weaponId: weapon.id,
      ammo: weapon.ammo,
      reserve: weapon.reserve,
      reloading: weapon.reloading,
      hit: hitResult
    };
  }
}

module.exports = { GameWorld };
