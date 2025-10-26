import { RemotePlayer } from './RemotePlayer.js';

export class RemotePlayerManager {
  constructor(scene, weaponTemplates = {}) {
    this.scene = scene;
    this.weaponTemplates = weaponTemplates;
    this.players = new Map();
  }

  setWeaponTemplates(templates) {
    this.weaponTemplates = templates || {};
    this.players.forEach((remote) => {
      remote.weaponTemplates = this.weaponTemplates;
      remote.refreshWeaponModel();
    });
  }

  ensure(id) {
    if (!this.players.has(id)) {
      const remote = new RemotePlayer(id, this.weaponTemplates);
      this.scene.add(remote.group);
      this.players.set(id, remote);
    }
    return this.players.get(id);
  }

  applySnapshot(snapshot, localId) {
    if (!snapshot || !Array.isArray(snapshot.players)) {
      return;
    }
    const seen = new Set();
    snapshot.players.forEach((info) => {
      if (!info || !info.id || info.id === localId) {
        return;
      }
      const remote = this.ensure(info.id);
      remote.setSnapshot(info);
      seen.add(info.id);
    });
    this.players.forEach((_, id) => {
      if (!seen.has(id)) {
        this.remove(id);
      }
    });
  }

  remove(id) {
    const remote = this.players.get(id);
    if (!remote) {
      return;
    }
    remote.dispose(this.scene);
    this.players.delete(id);
  }

  update(delta) {
    this.players.forEach((remote) => remote.update(delta));
  }

  highlightDamage(targetId, headshot) {
    const remote = this.players.get(targetId);
    if (!remote) {
      return;
    }
    remote.highlight(headshot);
  }

  setRespawn(targetId, position) {
    const remote = this.players.get(targetId);
    if (!remote) {
      return;
    }
    remote.setRespawn(position);
  }
}
