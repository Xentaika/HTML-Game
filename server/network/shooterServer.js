const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { MovementConfig } = require('../config/movementConfig');
const { GameWorld } = require('../game/gameWorld');
const { WEAPON_DEFINITIONS } = require('../config/weaponData');

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
    this.app.use('/three-examples', express.static(path.join(__dirname, '..', '..', 'node_modules/three/examples/jsm')));
  }

  setupSockets() {
    this.io.on('connection', (socket) => {
      const player = this.world.addPlayer(socket.id);

      socket.emit('init', {
        id: socket.id,
        snapshot: this.world.getSnapshot(),
        tickRate: this.config.tickRate,
        weapons: WEAPON_DEFINITIONS
      });

      socket.broadcast.emit('playerJoined', player.toSnapshot());

      socket.on('input', (payload) => {
        this.world.updatePlayerInput(socket.id, payload);
      });

      socket.on('clientPing', (_, respond) => {
        if (typeof respond === 'function') {
          respond({ serverTime: Date.now(), tick: this.world.tick });
        }
      });

      socket.on('shoot', () => {
        const result = this.world.registerHit(socket.id);
        if (!result) {
          return;
        }
        this.io.emit('weaponFired', {
          shooterId: result.shooterId,
          weaponId: result.weaponId,
          ammo: result.ammo,
          reserve: result.reserve,
          reloading: result.reloading
        });
        if (result.hit) {
          const hit = { shooterId: result.shooterId, ...result.hit };
          this.io.emit('playerHit', hit);
          if (hit.respawn) {
            this.io.emit('playerEliminated', {
              targetId: hit.targetId,
              killerId: hit.shooterId,
              respawn: hit.respawn,
              score: hit.score
            });
          }
        }
      });

      socket.on('reload', () => {
        const info = this.world.requestReload(socket.id);
        if (info) {
          socket.emit('reloadStarted', info);
          socket.broadcast.emit('remoteReload', { playerId: socket.id, ...info });
        }
      });

      socket.on('equipWeapon', ({ weaponId }) => {
        if (!weaponId) {
          return;
        }
        const result = this.world.handleEquip(socket.id, weaponId);
        socket.emit('inventoryUpdate', { ...result, context: 'equip' });
      });

      socket.on('buyWeapon', ({ weaponId }) => {
        if (!weaponId) {
          return;
        }
        const result = this.world.handleBuy(socket.id, weaponId);
        socket.emit('inventoryUpdate', { ...result, context: 'buy' });
        if (result.ok) {
          socket.broadcast.emit('playerPurchased', {
            playerId: socket.id,
            weaponId,
            activeWeapon: result.activeWeapon
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
