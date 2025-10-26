const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

class Weapon {
  constructor(definition) {
    this.definition = definition;
    this.id = definition.id;
    this.name = definition.name;
    this.slot = definition.slot;
    this.magazineSize = Number.isFinite(definition.magazineSize) ? definition.magazineSize : Infinity;
    this.maxReserve = Number.isFinite(definition.reserve) ? definition.reserve : Infinity;
    this.fireRate = definition.fireRate;
    this.reloadDuration = definition.reloadDuration;
    this.bodyDamage = definition.bodyDamage;
    this.headshotDamage = definition.headshotDamage;
    this.range = definition.range;
    this.price = definition.price || 0;
    this.reset();
  }

  reset() {
    this.ammo = Number.isFinite(this.magazineSize) ? this.magazineSize : Infinity;
    this.reserve = Number.isFinite(this.maxReserve) ? this.maxReserve : Infinity;
    this.lastShotTime = 0;
    this.reloading = false;
    this.reloadEndTime = 0;
  }

  canShoot(time) {
    if (this.reloading) {
      return false;
    }
    if (!Number.isFinite(this.ammo)) {
      return time - this.lastShotTime >= this.fireRate;
    }
    return this.ammo > 0 && time - this.lastShotTime >= this.fireRate;
  }

  tryShoot(time) {
    if (!this.canShoot(time)) {
      return false;
    }
    this.lastShotTime = time;
    if (Number.isFinite(this.ammo)) {
      this.ammo = clamp(this.ammo - 1, 0, this.magazineSize);
    }
    return true;
  }

  startReload(time) {
    if (this.reloading) {
      return false;
    }
    if (!Number.isFinite(this.ammo) || !Number.isFinite(this.reserve)) {
      return false;
    }
    if (this.ammo >= this.magazineSize || this.reserve <= 0) {
      return false;
    }
    this.reloading = true;
    this.reloadEndTime = time + this.reloadDuration;
    return true;
  }

  update(time) {
    if (!this.reloading || time < this.reloadEndTime) {
      return false;
    }
    const needed = this.magazineSize - this.ammo;
    const refill = Math.min(needed, this.reserve);
    this.ammo += refill;
    this.reserve -= refill;
    this.reloading = false;
    return true;
  }

  toState() {
    return {
      id: this.id,
      name: this.name,
      slot: this.slot,
      ammo: Number.isFinite(this.ammo) ? this.ammo : null,
      magazineSize: Number.isFinite(this.magazineSize) ? this.magazineSize : null,
      reserve: Number.isFinite(this.reserve) ? this.reserve : null,
      reloading: this.reloading,
      reloadEndTime: this.reloadEndTime,
      fireRate: this.fireRate
    };
  }
}

module.exports = { Weapon };
