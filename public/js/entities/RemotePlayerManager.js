import { RemoteAvatar } from './RemoteAvatar.js';

export class RemotePlayerManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.players = new Map();
  }

  ensure(id) {
    if (!this.players.has(id)) {
      const avatar = new RemoteAvatar(id);
      this.scene.add(avatar.group);
      this.players.set(id, avatar);
    }
    return this.players.get(id);
  }

  remove(id) {
    const avatar = this.players.get(id);
    if (!avatar) {
      return;
    }
    avatar.dispose(this.scene);
    this.players.delete(id);
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
      const avatar = this.ensure(info.id);
      avatar.setSnapshot(info);
      seen.add(info.id);
    });

    this.players.forEach((_, id) => {
      if (!seen.has(id)) {
        this.remove(id);
      }
    });
  }

  update(delta) {
    this.players.forEach((avatar) => avatar.update(delta));
  }

  updateNameplates() {
    this.players.forEach((avatar) => avatar.updateNameplate(this.camera));
  }

  highlightDamage(targetId, headshot) {
    const avatar = this.players.get(targetId);
    if (!avatar) {
      return;
    }
    avatar.bodyMaterial.color.set(headshot ? 0xff3b81 : 0x37d3ff);
    setTimeout(() => {
      avatar.bodyMaterial.color.set(0x3bf5ff);
    }, 420);
  }

  setRespawn(targetId, position) {
    const avatar = this.players.get(targetId);
    if (!avatar || !position) {
      return;
    }
    avatar.position.set(position.x, position.y, position.z);
    avatar.targetPosition.copy(avatar.position);
    avatar.group.position.copy(avatar.position);
    avatar.health = 100;
  }
}
