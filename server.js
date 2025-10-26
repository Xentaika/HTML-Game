const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

class MovementConfig {
  constructor() {
    this.tickRate = 128;
    this.fixedDelta = 1 / this.tickRate;
    this.gravity = 30;
    this.playerRadius = 0.6;
    this.playerHeight = 1.6;
    this.groundLevel = 1.6;
    this.runSpeed = 26; // default running pace (reduced per feedback)
    this.walkSpeed = 12; // shift enables deliberate walking
    this.acceleration = 240;
    this.friction = 32;
    this.jumpForce = 6.2;
  }
}

class ArenaCollider {
  constructor(position, scale) {
    const halfX = scale.x / 2;
    const halfY = scale.y / 2;
    const halfZ = scale.z / 2;

    this.min = {
      x: position.x - halfX,
      y: position.y - halfY,
      z: position.z - halfZ
    };
    this.max = {
      x: position.x + halfX,
      y: position.y + halfY,
      z: position.z + halfZ
    };
  }

  intersectsCapsule(top, bottom, radius) {
    if (top < this.min.y || bottom > this.max.y) {
      return false;
    }

    const nearestX = Math.max(this.min.x, Math.min(top.x, this.max.x));
    const nearestZ = Math.max(this.min.z, Math.min(top.z, this.max.z));

    const deltaX = top.x - nearestX;
    const deltaZ = top.z - nearestZ;
    return deltaX * deltaX + deltaZ * deltaZ < radius * radius;
  }
}

class MovementInput {
  constructor() {
    this.forward = false;
    this.backward = false;
    this.left = false;
    this.right = false;
    this.walk = false;
    this.jump = false;
  }

  setFromPayload(payload) {
    this.forward = Boolean(payload.forward);
    this.backward = Boolean(payload.backward);
    this.left = Boolean(payload.left);
    this.right = Boolean(payload.right);
    this.walk = Boolean(payload.walk);
    if (payload.jump) {
      this.jump = true;
    }
  }

  consumeJump() {
    const wantsJump = this.jump;
    this.jump = false;
    return wantsJump;
  }
}

class Player {
  constructor(id, spawnPoint, config) {
    this.id = id;
    this.config = config;
    this.position = { ...spawnPoint };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.quaternion = { x: 0, y: 0, z: 0, w: 1 };
    this.onGround = true;
    this.input = new MovementInput();
    this.health = 100;
    this.score = 0;
    this.lastUpdate = Date.now();
  }

  resetForRespawn(spawnPoint) {
    this.position = { ...spawnPoint };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.quaternion = { x: 0, y: 0, z: 0, w: 1 };
    this.onGround = true;
    this.input = new MovementInput();
    this.health = 100;
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

function approach(current, target, maxDelta) {
  if (current < target) {
    return Math.min(current + maxDelta, target);
  }
  if (current > target) {
    return Math.max(current - maxDelta, target);
  }
  return target;
}

function resolvePlayerCollisions(player, previousPosition, colliders, radius) {
  const top = player.position.y;
  const bottom = top - player.config.playerHeight;

  colliders.forEach((collider) => {
    if (top < collider.min.y || bottom > collider.max.y) {
      return;
    }

    const nearestX = Math.max(collider.min.x, Math.min(player.position.x, collider.max.x));
    const nearestZ = Math.max(collider.min.z, Math.min(player.position.z, collider.max.z));

    let deltaX = player.position.x - nearestX;
    let deltaZ = player.position.z - nearestZ;
    let distanceSq = deltaX * deltaX + deltaZ * deltaZ;

    const radiusSq = radius * radius;
    if (distanceSq >= radiusSq) {
      return;
    }

    if (distanceSq === 0) {
      deltaX = player.position.x - previousPosition.x;
      deltaZ = player.position.z - previousPosition.z;
      distanceSq = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSq === 0) {
        deltaX = 1;
        deltaZ = 0;
        distanceSq = 1;
      }
    }

    let distance = Math.sqrt(distanceSq);
    if (distance === 0) {
      distance = 1;
    }

    const penetration = radius - distance;
    const normalX = deltaX / distance;
    const normalZ = deltaZ / distance;

    player.position.x += normalX * penetration;
    player.position.z += normalZ * penetration;

    if ((normalX > 0 && player.velocity.x < 0) || (normalX < 0 && player.velocity.x > 0)) {
      player.velocity.x = 0;
    }
    if ((normalZ > 0 && player.velocity.z < 0) || (normalZ < 0 && player.velocity.z > 0)) {
      player.velocity.z = 0;
    }
  });
}

function normalize(vec) {
  const length = Math.hypot(vec.x, vec.y, vec.z);
  if (length === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: vec.x / length, y: vec.y / length, z: vec.z / length };
}

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

  step() {
    this.players.forEach((player) => {
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

  findPlayer(id) {
    return this.players.get(id);
  }

  registerHit(shooterId, origin, direction) {
    const shooter = this.players.get(shooterId);
    if (!shooter) {
      return null;
    }

    const dir = normalize(direction);
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
        damage = 100;
        headshot = true;
        along = headData.alongRay;
      } else if (withinRange(bodyData) && bodyData.distance <= 0.65) {
        damage = 25;
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

function distancePointToLine(point, origin, direction) {
  const px = point.x - origin.x;
  const py = point.y - origin.y;
  const pz = point.z - origin.z;
  const proj = px * direction.x + py * direction.y + pz * direction.z;
  const closestX = origin.x + direction.x * proj;
  const closestY = origin.y + direction.y * proj;
  const closestZ = origin.z + direction.z * proj;
  const dx = point.x - closestX;
  const dy = point.y - closestY;
  const dz = point.z - closestZ;
  return { distance: Math.hypot(dx, dy, dz), alongRay: proj };
}

class ShooterServer {
  constructor() {
    this.config = new MovementConfig();
    this.world = new GameWorld(this.config);

    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server);

    this.setupStatic();
    this.setupSockets();
    this.startTicker();

    this.defaultPort = Number(process.env.PORT) || 3000;
    this.portLocked = Boolean(process.env.PORT);
    this.requestedPort = this.defaultPort;
  }

  setupStatic() {
    this.app.use(express.static(path.join(__dirname, 'public')));
    this.app.use('/three', express.static(path.join(__dirname, 'node_modules/three/build')));
    this.app.use(
      '/three-examples',
      express.static(path.join(__dirname, 'node_modules/three/examples/jsm'))
    );
  }

  setupSockets() {
    this.io.on('connection', (socket) => {
      const player = this.world.addPlayer(socket.id);

      socket.emit('init', {
        id: socket.id,
        snapshot: this.world.getSnapshot()
      });

      socket.broadcast.emit('playerJoined', player.toSnapshot());

      socket.on('input', (payload) => {
        this.world.updatePlayerInput(socket.id, payload);
        if (payload && payload.quaternion) {
          this.world.updatePlayerQuaternion(socket.id, payload.quaternion);
        }
      });

      socket.on('shoot', ({ origin, direction }) => {
        if (!origin || !direction) {
          return;
        }
        const result = this.world.registerHit(socket.id, origin, direction);
        if (!result) {
          return;
        }

        this.io.emit('playerHit', result);
        if (result.respawn) {
          this.io.emit('playerEliminated', {
            targetId: result.targetId,
            killerId: result.shooterId,
            respawn: result.respawn,
            score: result.score
          });
        }
      });

      socket.on('disconnect', () => {
        this.world.removePlayer(socket.id);
        socket.broadcast.emit('playerLeft', { id: socket.id });
      });
    });
  }

  startTicker() {
    const interval = 1000 / this.config.tickRate;
    setInterval(() => {
      if (this.world.players.size === 0) {
        return;
      }
      this.world.step();
      this.io.emit('stateSnapshot', this.world.getSnapshot());
    }, interval);
  }

  listen() {
    this.server.on('listening', () => {
      const address = this.server.address();
      const activePort = typeof address === 'object' && address ? address.port : this.requestedPort;
      console.log(`Server listening on http://localhost:${activePort}`);
    });

    this.server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && !this.portLocked && this.requestedPort !== 0) {
        console.warn(`Port ${this.requestedPort} is busy, attempting to use a random available port.`);
        this.requestedPort = 0;
        this.server.listen(this.requestedPort);
        return;
      }

      console.error('Failed to start server:', err);
      process.exit(1);
    });

    this.server.listen(this.requestedPort);
  }
}

new ShooterServer().listen();
