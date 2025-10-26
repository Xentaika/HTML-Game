const { Character } = require('../entities/character');
const { Player } = require('../entities/player');
const { Weapon } = require('../entities/weapon');
const { ArenaCollider } = require('./arenaCollider');
const { normalize, distancePointToLine } = require('../util/math');

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
  }

  createDefaultCharacter() {
    return new Character({
      name: 'Initiate',
      maxHealth: 100,
      loadout: {
        primary: new Weapon({})
      }
    });
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

  updatePlayerQuaternion(id, quaternion) {
    const player = this.players.get(id);
    if (!player) {
      return;
    }
    player.updateQuaternion(quaternion);
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
    if (!shooter) {
      return null;
    }

    const weapon = shooter.weapon;
    const now = Date.now() / 1000;
    const shot = shooter.prepareShot(now);
    if (!shot) {
      return null;
    }

    const { origin, direction } = shot;
    const dir = normalize(direction);
    if (dir.x === 0 && dir.y === 0 && dir.z === 0) {
      return null;
    }
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

      const withinRange = (data) => data.alongRay > 0 && data.alongRay < 80;

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
