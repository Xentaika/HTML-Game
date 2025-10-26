const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/three', express.static(path.join(__dirname, 'node_modules/three/build')));
app.use(
  '/three-examples',
  express.static(path.join(__dirname, 'node_modules/three/examples/jsm'))
);

const RESPAWN_POINTS = [
  { x: 0, y: 1.6, z: 0 },
  { x: 10, y: 1.6, z: -5 },
  { x: -8, y: 1.6, z: 4 },
  { x: 6, y: 1.6, z: 10 },
  { x: -5, y: 1.6, z: -12 }
];

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
      y: target.position.y + 1.5,
      z: target.position.z
    };
    const bodyCenter = {
      x: target.position.x,
      y: target.position.y + 0.9,
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

  socket.on('stateUpdate', (state) => {
    const current = players.get(socket.id);
    if (!current) {
      return;
    }

    current.position = state.position;
    current.quaternion = state.quaternion;
    current.lastUpdate = Date.now();

    socket.broadcast.emit('playerState', {
      id: socket.id,
      position: current.position,
      quaternion: current.quaternion,
      health: current.health,
      score: current.score
    });
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

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
