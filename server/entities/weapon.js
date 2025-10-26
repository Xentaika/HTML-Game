class Weapon {
  constructor(id, template) {
    this.id = id;
    this.template = template;
    this.name = template.name;
    this.slot = template.slot;
    this.magazineSize = template.magazineSize;
    this.maxReserve = template.reserve;
    this.fireRate = template.fireRate;
    this.reloadDuration = template.reloadDuration;
    this.bodyDamage = template.bodyDamage;
    this.headshotDamage = template.headshotDamage;
    this.range = template.range;
    this.moveSpeedModifier = template.moveSpeedModifier ?? 1;
    this.isMelee = this.slot === 'melee';
    this.reset();
  }

  canShoot(time) {
    if (this.isMelee) {
      return time - this.lastShotTime >= this.fireRate;
    }
    if (this.reloading) {
      return false;
    }
    if (this.ammo <= 0) {
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
    if (this.reloading) {
      return false;
    }
    if (this.ammo >= this.magazineSize) {
      return false;
    }
    if (this.reserve <= 0) {
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

  reset() {
    this.ammo = this.isMelee ? 1 : this.magazineSize;
    this.reserve = this.maxReserve;
    this.reloading = false;
    this.reloadEndTime = 0;
    this.lastShotTime = 0;
  }

  clone() {
    const weapon = new Weapon(this.id, this.template);
    weapon.ammo = this.ammo;
    weapon.reserve = this.reserve;
    weapon.reloading = this.reloading;
    weapon.reloadEndTime = this.reloadEndTime;
    weapon.lastShotTime = this.lastShotTime;
    return weapon;
  }

  toNetworkState() {
    return {
      id: this.id,
      name: this.name,
      slot: this.slot,
      ammo: this.isMelee ? null : this.ammo,
      magazineSize: this.magazineSize,
      reserve: this.isMelee ? null : this.reserve,
      reloading: this.reloading,
      reloadDuration: this.reloadDuration,
      reloadEndTime: this.reloadEndTime,
      moveSpeedModifier: this.moveSpeedModifier
    };
  }
}

module.exports = { Weapon };
