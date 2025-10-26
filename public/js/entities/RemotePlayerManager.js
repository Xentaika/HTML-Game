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
    const original = avatar.bodyRoot.children[0];
    if (!original || !original.material) {
      return;
    }
    const baseColor = original.material.color.clone();
    original.material.color.set(headshot ? 0xc3423f : 0x4aa564);
    setTimeout(() => {
      original.material.color.copy(baseColor);
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

  onWeaponReload(playerId, weapon) {
    const avatar = this.players.get(playerId);
    if (!avatar) {
      return;
    }
    avatar.setWeapon(weapon);
    const now = Date.now() / 1000;
    const duration = weapon && weapon.reloadEndTime ? Math.max(0.4, weapon.reloadEndTime - now) : 1.6;
    avatar.setReloading(duration);
  }

  onWeaponFire(playerId, weapon) {
    const avatar = this.players.get(playerId);
    if (!avatar) {
      return;
    }
    avatar.setWeapon(weapon);
    avatar.triggerFire();
  }
}
