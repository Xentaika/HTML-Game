import { WEAPON_PRESETS } from '../config/weaponPresets.js';

export class WeaponState {
  constructor(weaponId = 'glock18') {
    this.applyDefinition(weaponId);
  }

  applyDefinition(weaponId) {
    const preset = WEAPON_PRESETS[weaponId] || WEAPON_PRESETS.glock18;
    this.id = preset.id;
    this.name = preset.name;
    this.slot = preset.slot;
    this.magazineSize = Number.isFinite(preset.magazineSize) ? preset.magazineSize : null;
    this.reserveMax = Number.isFinite(preset.reserve) ? preset.reserve : null;
    this.fireRate = preset.fireRate;
    this.reloadDuration = preset.reloadDuration;
    this.bodyDamage = preset.bodyDamage;
    this.headshotDamage = preset.headshotDamage;
    this.range = preset.range;
    this.price = preset.price;
    this.ammo = this.magazineSize ?? null;
    this.reserve = this.reserveMax ?? null;
    this.reloading = false;
    this.reloadEndTime = 0;
    this.lastShotTime = 0;
  }

  clone() {
    const copy = new WeaponState(this.id);
    copy.ammo = this.ammo;
    copy.reserve = this.reserve;
    copy.reloading = this.reloading;
    copy.reloadEndTime = this.reloadEndTime;
    return copy;
  }

  updateFromServer(state) {
    if (!state) {
      return;
    }
    if (state.id && state.id !== this.id) {
      this.applyDefinition(state.id);
    }
    if (state.magazineSize != null) {
      this.magazineSize = state.magazineSize;
    }
    this.ammo = state.ammo != null ? state.ammo : null;
    this.reserve = state.reserve != null ? state.reserve : null;
    if (state.reloadEndTime) {
      const nowServer = Date.now() / 1000;
      const remaining = Math.max(0, state.reloadEndTime - nowServer);
      this.reloading = remaining > 0;
      this.reloadEndTime = performance.now() / 1000 + remaining;
    } else {
      this.reloading = Boolean(state.reloading);
      this.reloadEndTime = this.reloading ? performance.now() / 1000 + this.reloadDuration : 0;
    }
  }

  canShoot(now) {
    if (this.reloading) {
      return false;
    }
    if (now - this.lastShotTime < this.fireRate) {
      return false;
    }
    if (this.magazineSize == null) {
      return true;
    }
    return (this.ammo ?? 0) > 0;
  }

  consumeShot(now) {
    if (this.magazineSize != null && this.ammo != null) {
      this.ammo = Math.max(0, this.ammo - 1);
    }
    this.lastShotTime = now;
  }

  startReload(now) {
    if (this.reloading) {
      return false;
    }
    if (this.magazineSize == null || this.reserve == null) {
      return false;
    }
    if (this.ammo >= this.magazineSize || this.reserve <= 0) {
      return false;
    }
    this.reloading = true;
    this.reloadEndTime = now + this.reloadDuration;
    return true;
  }

  finishReload() {
    if (!this.reloading) {
      return false;
    }
    if (this.magazineSize == null || this.reserve == null) {
      this.reloading = false;
      return false;
    }
    const needed = this.magazineSize - this.ammo;
    const used = Math.min(needed, this.reserve);
    this.ammo += used;
    this.reserve -= used;
    this.reloading = false;
    this.reloadEndTime = 0;
    return true;
  }
}
