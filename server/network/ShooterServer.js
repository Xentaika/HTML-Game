import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { GameWorld } from '../core/GameWorld.js';
import { ServerConfig } from '../config/serverConfig.js';
import { WeaponShopOrder } from '../../shared/weapons.js';
import { RESPAWN_TIME } from '../../shared/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ShooterServer {
  constructor() {
    this.world = new GameWorld();
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server);
    this.port = Number(process.env.PORT) || 3000;

    this.configureStatic();
    this.configureSockets();
    this.startLoop();
  }

  configureStatic() {
    const root = path.join(__dirname, '..', '..');
    this.app.use(express.static(path.join(root, 'public')));
    this.app.use('/three', express.static(path.join(root, 'node_modules/three/build')));
    this.app.use('/three-examples', express.static(path.join(root, 'node_modules/three/examples/jsm')));
    this.app.use('/shared', express.static(path.join(root, 'shared')));
  }

  configureSockets() {
    this.io.on('connection', (socket) => {
      const player = this.world.addPlayer(socket.id);
      socket.emit('init', {
        id: socket.id,
        snapshot: this.world.getSnapshot(),
        config: {
          tickRate: ServerConfig.tickRate,
          buy: {
            order: WeaponShopOrder
          }
        }
      });

      socket.broadcast.emit('playerJoined', { id: player.id });

      socket.on('input', (payload) => {
        if (!payload) {
          return;
        }
        this.world.enqueueInput(socket.id, payload);
      });

      socket.on('clientPing', (payload, respond) => {
        if (typeof respond === 'function') {
          respond({ serverTime: Date.now() });
        }
      });

      socket.on('shoot', () => {
        const now = Date.now() / 1000;
        const result = this.world.attemptShot(socket.id, now);
        if (!result) {
          return;
        }
        socket.emit('shotResult', result);
        if (result.hit) {
          this.io.emit('playerHit', result);
          if (result.lethal) {
            this.io.emit('playerEliminated', {
              targetId: result.targetId,
              killerId: result.shooterId,
              respawnTime: RESPAWN_TIME,
              weaponId: result.weaponId
            });
          }
        }
      });

      socket.on('reload', () => {
        const success = this.world.requestReload(socket.id, Date.now() / 1000);
        if (success) {
          socket.emit('reloadAcknowledged');
        }
      });

      socket.on('switchWeapon', (weaponId) => {
        if (this.world.requestWeaponSwitch(socket.id, weaponId)) {
          socket.emit('weaponSwitched', { weaponId });
        }
      });

      socket.on('buyWeapon', (weaponId, respond) => {
        const result = this.world.requestBuy(socket.id, weaponId);
        if (typeof respond === 'function') {
          respond(result);
        }
        if (result.success) {
          socket.emit('weaponSwitched', { weaponId });
        }
      });

      socket.on('disconnect', () => {
        this.world.removePlayer(socket.id);
        socket.broadcast.emit('playerLeft', { id: socket.id });
      });
    });
  }

  startLoop() {
    const interval = 1000 / ServerConfig.tickRate;
    setInterval(() => {
      if (this.world.players.size === 0) {
        return;
      }
      this.world.step();
      const snapshot = this.world.getSnapshot();
      this.io.emit('snapshot', snapshot);
    }, interval);
  }

  listen() {
    this.server.listen(this.port, () => {
      console.log(`Server listening on http://localhost:${this.port}`);
    });
  }
}
