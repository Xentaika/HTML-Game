class Weapon {
  constructor({ name = 'Sidearm', magazineSize = 12, reserve = 60, fireRate = 0.22, reloadDuration = 1.4, bodyDamage = 25, headshotDamage = 100 } = {}) {
    this.name = name;
    this.magazineSize = magazineSize;
    this.maxReserve = reserve;
    this.fireRate = fireRate;
    this.reloadDuration = reloadDuration;
    this.bodyDamage = bodyDamage;
    this.headshotDamage = headshotDamage;

    this.reset();
  }

  canShoot(time) {
    return !this.reloading && this.ammo > 0 && time - this.lastShotTime >= this.fireRate;
  }

  tryShoot(time) {
    if (!this.canShoot(time)) {
      return false;
    }
    this.lastShotTime = time;
    this.ammo -= 1;
    return true;
  }

  startReload(time) {
    if (this.reloading || this.ammo === this.magazineSize || this.reserve === 0) {
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
    const used = Math.min(needed, this.reserve);
    this.reserve -= used;
    this.ammo += used;
    this.reloading = false;
    return true;
  }

  reset() {
    this.ammo = this.magazineSize;
    this.reserve = this.maxReserve;
    this.reloading = false;
    this.reloadEndTime = 0;
    this.lastShotTime = 0;
  }
}

module.exports = { Weapon };
