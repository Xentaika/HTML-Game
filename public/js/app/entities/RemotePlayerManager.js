import { RemotePlayer } from './RemotePlayer.js';

export class RemotePlayerManager {
  constructor(scene) {
    this.scene = scene;
    this.players = new Map();
  }

  ensure(id) {
    let player = this.players.get(id);
    if (!player) {
      player = new RemotePlayer(this.scene);
      this.players.set(id, player);
    }
    return player;
  }

  applySnapshot(snapshot, localId) {
    const seen = new Set();
    snapshot.players.forEach((info) => {
      if (info.id === localId) {
        return;
      }
      const remote = this.ensure(info.id);
      remote.applySnapshot(info);
      seen.add(info.id);
    });

    Array.from(this.players.entries()).forEach(([id, player]) => {
      if (!seen.has(id)) {
        player.dispose();
        this.players.delete(id);
      }
    });
  }

  update(delta) {
    this.players.forEach((player) => player.update(delta));
  }

  remove(id) {
    const player = this.players.get(id);
    if (!player) {
      return;
    }
    player.dispose();
    this.players.delete(id);
  }
}
