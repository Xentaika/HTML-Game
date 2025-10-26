const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const portLocked = Boolean(process.env.PORT);
let requestedPort = DEFAULT_PORT;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/three', express.static(path.join(__dirname, 'node_modules/three/build')));
app.use(
  '/three-examples',
  express.static(path.join(__dirname, 'node_modules/three/examples/jsm'))
);

const TICK_RATE = 128;
const FIXED_DELTA = 1 / TICK_RATE;
const GROUND_LEVEL = 1.6;
const PLAYER_RADIUS = 0.6;
const PLAYER_HEIGHT = 1.6;
const GRAVITY = 30;
const WALK_SPEED = 18;
const RUN_SPEED = 48 / 1.3;
const ACCELERATION = 220;
const FRICTION = 28;
const JUMP_FORCE = 7.2;

const RESPAWN_POINTS = [
  { x: 0, y: GROUND_LEVEL, z: 0 },
  { x: 10, y: GROUND_LEVEL, z: -5 },
  { x: -8, y: GROUND_LEVEL, z: 4 },
  { x: 6, y: GROUND_LEVEL, z: 10 },
  { x: -5, y: GROUND_LEVEL, z: -12 }
];

const ARENA_OBSTACLES = [
  { position: { x: 0, y: 2, z: -12 }, scale: { x: 4, y: 4, z: 4 } },
  { position: { x: -10, y: 1.2, z: 6 }, scale: { x: 6, y: 2.4, z: 4 } },
  { position: { x: 12, y: 3, z: 10 }, scale: { x: 4, y: 6, z: 4 } },
  { position: { x: -14, y: 2.5, z: -8 }, scale: { x: 5, y: 5, z: 5 } }
];

const COLLIDERS = ARENA_OBSTACLES.map(({ position, scale }) => {
  const halfX = scale.x / 2;
  const halfY = scale.y / 2;
  const halfZ = scale.z / 2;
  return {
    min: {
      x: position.x - halfX,
      y: position.y - halfY,
      z: position.z - halfZ
    },
    max: {
      x: position.x + halfX,
      y: position.y + halfY,
      z: position.z + halfZ
    }
  };
});

const players = new Map();

function getRandomRespawn() {
  return RESPAWN_POINTS[Math.floor(Math.random() * RESPAWN_POINTS.length)];
}

function createPlayer(id) {
  const spawn = getRandomRespawn();
  return {
    id,
    position: { ...spawn },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    velocity: { x: 0, y: 0, z: 0 },
    onGround: true,
    input: {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false
    },
    health: 100,
    score: 0,
    lastUpdate: Date.now()
  };
}

function serializePlayers() {
  return Array.from(players.values()).map((player) => ({
    id: player.id,
    position: player.position,
    quaternion: player.quaternion,
    health: player.health,
    score: player.score
  }));
}

function normalize(vec) {
  const length = Math.hypot(vec.x, vec.y, vec.z);
  if (length === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: vec.x / length, y: vec.y / length, z: vec.z / length };
}

function applyQuaternion(vector, quaternion) {
  const { x, y, z } = vector;
  const { x: qx, y: qy, z: qz, w: qw } = quaternion;

  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx
  };
}

function getForward(quaternion) {
  return applyQuaternion({ x: 0, y: 0, z: -1 }, quaternion);
}

function getRight(quaternion) {
  return applyQuaternion({ x: 1, y: 0, z: 0 }, quaternion);
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

function resolvePlayerCollisions(player, previousPosition) {
  const top = player.position.y;
  const bottom = top - PLAYER_HEIGHT;

  COLLIDERS.forEach((collider) => {
    if (top < collider.min.y || bottom > collider.max.y) {
      return;
    }

    const nearestX = Math.max(collider.min.x, Math.min(player.position.x, collider.max.x));
    const nearestZ = Math.max(collider.min.z, Math.min(player.position.z, collider.max.z));

    let deltaX = player.position.x - nearestX;
    let deltaZ = player.position.z - nearestZ;
    let distanceSq = deltaX * deltaX + deltaZ * deltaZ;

    const radiusSq = PLAYER_RADIUS * PLAYER_RADIUS;
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
    const penetration = PLAYER_RADIUS - distance;
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

function stepPlayer(player) {
  const input = player.input;

  const forward = getForward(player.quaternion);
  forward.y = 0;
  const forwardLength = Math.hypot(forward.x, forward.z);
  if (forwardLength > 0) {
    forward.x /= forwardLength;
    forward.z /= forwardLength;
  }

  const right = getRight(player.quaternion);
  right.y = 0;
  const rightLength = Math.hypot(right.x, right.z);
  if (rightLength > 0) {
    right.x /= rightLength;
    right.z /= rightLength;
  }

  let desiredX = 0;
  let desiredZ = 0;

  if (input.forward) {
    desiredX += forward.x;
    desiredZ += forward.z;
  }
  if (input.backward) {
    desiredX -= forward.x;
    desiredZ -= forward.z;
  }
  if (input.right) {
    desiredX += right.x;
    desiredZ += right.z;
  }
  if (input.left) {
    desiredX -= right.x;
    desiredZ -= right.z;
  }

  const magnitude = Math.hypot(desiredX, desiredZ);
  if (magnitude > 0) {
    desiredX /= magnitude;
    desiredZ /= magnitude;
  }

  const targetSpeed = input.sprint ? RUN_SPEED : WALK_SPEED;
  const targetX = desiredX * targetSpeed;
  const targetZ = desiredZ * targetSpeed;

  player.velocity.x = approach(player.velocity.x, targetX, ACCELERATION * FIXED_DELTA);
  player.velocity.z = approach(player.velocity.z, targetZ, ACCELERATION * FIXED_DELTA);

  if (magnitude === 0) {
    player.velocity.x = approach(player.velocity.x, 0, FRICTION * FIXED_DELTA);
    player.velocity.z = approach(player.velocity.z, 0, FRICTION * FIXED_DELTA);
  }

  if (input.jump) {
    if (player.onGround) {
      player.velocity.y = JUMP_FORCE;
      player.onGround = false;
    }
    player.input.jump = false;
  }

  player.velocity.y -= GRAVITY * FIXED_DELTA;

  const previousPosition = { ...player.position };
  player.position.x += player.velocity.x * FIXED_DELTA;
  player.position.y += player.velocity.y * FIXED_DELTA;
  player.position.z += player.velocity.z * FIXED_DELTA;

  resolvePlayerCollisions(player, previousPosition);

  if (player.position.y < GROUND_LEVEL) {
    player.position.y = GROUND_LEVEL;
    if (player.velocity.y < 0) {
      player.velocity.y = 0;
    }
    player.onGround = true;
  } else if (player.velocity.y > 0) {
    player.onGround = false;
  }
}

function broadcastState() {
  if (players.size === 0) {
    return;
  }
  io.emit('stateSnapshot', { players: serializePlayers() });
}

function tick() {
  players.forEach((player) => {
    stepPlayer(player);
  });
  broadcastState();
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

function tryRegisterHit(shooterId, origin, direction) {
  const shooter = players.get(shooterId);
  if (!shooter) {
    return;
  }

  const dir = normalize(direction);
  let bestHit = null;

  players.forEach((target, targetId) => {
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
    return;
  }

  const { target, damage, headshot } = bestHit;
  target.health = Math.max(0, target.health - damage);

  const payload = {
    shooterId,
    targetId: target.id,
    damage,
    headshot,
    remaining: target.health
  };

  io.emit('playerHit', payload);

  if (target.health === 0) {
    const shooter = players.get(shooterId);
    if (shooter) {
      shooter.score += 1;
    }

    const respawn = getRandomRespawn();
    target.position = { ...respawn };
    target.quaternion = { x: 0, y: 0, z: 0, w: 1 };
    target.velocity = { x: 0, y: 0, z: 0 };
    target.onGround = true;
    target.input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false
    };
    target.health = 100;

    io.emit('playerEliminated', {
      targetId: target.id,
      killerId: shooterId,
      respawn: target.position,
      score: shooter ? shooter.score : 0
    });
  }
}

io.on('connection', (socket) => {
  const player = createPlayer(socket.id);
  players.set(socket.id, player);

  socket.emit('init', {
    id: socket.id,
    players: serializePlayers()
  });

  socket.broadcast.emit('playerJoined', {
    id: player.id,
    position: player.position,
    quaternion: player.quaternion,
    health: player.health,
    score: player.score
  });

  socket.on('input', (input) => {
    const current = players.get(socket.id);
    if (!current || !input) {
      return;
    }

    current.input.forward = Boolean(input.forward);
    current.input.backward = Boolean(input.backward);
    current.input.left = Boolean(input.left);
    current.input.right = Boolean(input.right);
    current.input.sprint = Boolean(input.sprint);
    if (input.jump) {
      current.input.jump = true;
    }

    if (input.quaternion) {
      const { x, y, z, w } = input.quaternion;
      const length = Math.hypot(x, y, z, w);
      if (length > 0) {
        current.quaternion = {
          x: x / length,
          y: y / length,
          z: z / length,
          w: w / length
        };
      }
    }

    current.lastUpdate = Date.now();
  });

  socket.on('shoot', ({ origin, direction }) => {
    if (!origin || !direction) {
      return;
    }
    tryRegisterHit(socket.id, origin, direction);
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    socket.broadcast.emit('playerLeft', { id: socket.id });
  });
});

setInterval(tick, 1000 / TICK_RATE);

server.on('listening', () => {
  const address = server.address();
  const activePort = typeof address === 'object' && address ? address.port : requestedPort;
  console.log(`Server listening on http://localhost:${activePort}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && !portLocked && requestedPort !== 0) {
    console.warn(`Port ${requestedPort} is busy, attempting to use a random available port.`);
    requestedPort = 0;
    server.listen(requestedPort);
    return;
  }

  console.error('Failed to start server:', err);
  process.exit(1);
});

server.listen(requestedPort);
