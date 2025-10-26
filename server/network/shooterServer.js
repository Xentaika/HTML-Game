const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { MovementConfig } = require('../config/movementConfig');
const { GameWorld } = require('../game/gameWorld');

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
    this.app.use(express.static(path.join(__dirname, '..', '..', 'public')));
    this.app.use('/three', express.static(path.join(__dirname, '..', '..', 'node_modules/three/build')));
    this.app.use(
      '/three-examples',
      express.static(path.join(__dirname, '..', '..', 'node_modules/three/examples/jsm'))
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

module.exports = { ShooterServer };
