export class WeaponInstance {
  constructor(id, template) {
    this.id = id;
    this.template = template;
    this.name = template.name;
    this.slot = template.slot;
    this.isMelee = this.slot === 'melee';
    this.fireRate = template.fireRate;
    this.bodyDamage = template.bodyDamage;
    this.headshotDamage = template.headshotDamage;
    this.reloadDuration = template.reloadDuration;
    this.moveSpeedModifier = template.moveSpeedModifier ?? 1;
    this.range = template.range ?? 80;
    this.magazineSize = template.magazineSize;
    this.maxReserve = template.reserve;
    this.reset();
  }

  reset() {
    this.ammo = this.isMelee ? 1 : this.magazineSize;
    this.reserve = this.isMelee ? 0 : this.maxReserve;
    this.reloading = false;
    this.reloadEndTime = 0;
    this.lastShotTime = 0;
  }

  clone() {
    const weapon = new WeaponInstance(this.id, this.template);
    weapon.ammo = this.ammo;
    weapon.reserve = this.reserve;
    weapon.reloading = this.reloading;
    weapon.reloadEndTime = this.reloadEndTime;
    weapon.lastShotTime = this.lastShotTime;
    return weapon;
  }

  canShoot(time) {
    if (this.isMelee) {
      return time - this.lastShotTime >= this.fireRate;
    }
    if (this.reloading || this.ammo <= 0) {
      return false;
    }
    return time - this.lastShotTime >= this.fireRate;
  }

  tryShoot(time) {
    if (!this.canShoot(time)) {
      return false;
    }
    this.lastShotTime = time;
    if (!this.isMelee) {
      this.ammo -= 1;
    }
    return true;
  }

  startReload(time) {
    if (this.isMelee) {
      return false;
    }
    if (this.reloading || this.ammo >= this.magazineSize || this.reserve <= 0) {
      return false;
    }
    this.reloading = true;
    this.reloadEndTime = time + this.reloadDuration;
    return true;
  }

  update(time) {
    if (!this.reloading) {
      return false;
    }
    if (time < this.reloadEndTime) {
      return false;
    }
    const needed = this.magazineSize - this.ammo;
    const used = Math.min(needed, this.reserve);
    this.reserve -= used;
    this.ammo += used;
    this.reloading = false;
    return true;
  }

  applyNetworkState(state) {
    if (!state) {
      return;
    }
    this.ammo = state.ammo != null ? state.ammo : this.ammo;
    this.reserve = state.reserve != null ? state.reserve : this.reserve;
    this.reloading = Boolean(state.reloading);
    this.reloadEndTime = state.reloadEndTime || 0;
  }
}
