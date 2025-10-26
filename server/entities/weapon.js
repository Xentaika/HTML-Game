const { WEAPON_DEFINITIONS } = require('../config/weaponData');

class WeaponState {
  constructor(definition) {
    if (!definition) {
      throw new Error('Weapon definition is required');
    }
    this.definition = definition;
    this.id = definition.id;
    this.reset();
  }

  clone() {
    const next = new WeaponState(this.definition);
    next.ammo = this.ammo;
    next.reserve = this.reserve;
    next.reloading = this.reloading;
    next.reloadEndTime = this.reloadEndTime;
    next.lastShotTime = this.lastShotTime;
    return next;
  }

  reset() {
    const { magazineSize, reserve } = this.definition;
    this.ammo = typeof magazineSize === 'number' ? magazineSize : Infinity;
    this.reserve = typeof reserve === 'number' ? reserve : Infinity;
    this.reloading = false;
    this.reloadEndTime = 0;
    this.lastShotTime = 0;
  }

  isMelee() {
    return this.definition.type === 'melee';
  }

  canShoot(time) {
    if (this.reloading) {
      return false;
    }
    if (time - this.lastShotTime < this.definition.fireInterval) {
      return false;
    }
    if (this.isMelee()) {
      return true;
    }
    return this.ammo > 0;
  }

  pullTrigger(time) {
    if (!this.canShoot(time)) {
      return null;
    }
    this.lastShotTime = time;
    if (!this.isMelee()) {
      this.ammo = Math.max(0, this.ammo - 1);
    }
    return {
      type: this.definition.type,
      spread: this.definition.spread || 0,
      range: this.definition.range || 60
    };
  }

  startReload(time) {
    if (this.isMelee()) {
      return null;
    }
    if (this.reloading || this.ammo >= this.definition.magazineSize) {
      return null;
    }
    if (this.reserve <= 0) {
      return null;
    }
    const reloadTime = this.definition.reloadTime || 2.0;
    this.reloading = true;
    this.reloadEndTime = time + reloadTime;
    return { endTime: this.reloadEndTime, duration: reloadTime };
  }

  update(time) {
    if (!this.reloading || time < this.reloadEndTime) {
      return false;
    }
    const magazineSize = this.definition.magazineSize || 0;
    const need = magazineSize - this.ammo;
    if (need <= 0) {
      this.reloading = false;
      return false;
    }
    const available = Math.min(need, this.reserve);
    this.ammo += available;
    this.reserve -= available;
    this.reloading = false;
    return true;
  }

  toJSON() {
    return {
      id: this.id,
      ammo: this.ammo,
      reserve: this.reserve,
      reloading: this.reloading,
      reloadEndTime: this.reloadEndTime,
      lastShotTime: this.lastShotTime
    };
  }
}

function createWeaponState(weaponId) {
  const definition = WEAPON_DEFINITIONS[weaponId];
  if (!definition) {
    throw new Error(`Unknown weapon id: ${weaponId}`);
  }
  return new WeaponState(definition);
}

module.exports = { WeaponState, createWeaponState };
