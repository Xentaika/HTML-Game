export class Weapon {
  constructor() {
    this.magazineSize = 12;
    this.ammo = 12;
    this.reserve = 60;
    this.fireRate = 0.22;
    this.reloadDuration = 1.4;
    this.reloading = false;
    this.reloadEndTime = 0;
    this.lastShot = 0;
  }

  canShoot(time) {
    return !this.reloading && this.ammo > 0 && time - this.lastShot >= this.fireRate;
  }

  shoot(time) {
    if (!this.canShoot(time)) {
      return false;
    }
    this.lastShot = time;
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
    this.reserve = 60;
    this.reloading = false;
    this.reloadEndTime = 0;
  }
}
