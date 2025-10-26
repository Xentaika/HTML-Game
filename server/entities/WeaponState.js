import { WeaponDefinitions } from '../../shared/weapons.js';

export class WeaponState {
  constructor(weaponId) {
    this.setDefinition(weaponId);
    this.ammoInMagazine = Number.isFinite(this.definition.magazineSize)
      ? this.definition.magazineSize
      : Infinity;
    this.reserveAmmo = this.definition.reserveAmmo;
    this.lastShotTime = -Infinity;
    this.reloadEndTime = 0;
    this.isReloading = false;
  }

  setDefinition(weaponId) {
    this.weaponId = weaponId;
    this.definition = WeaponDefinitions[weaponId];
    if (!this.definition) {
      throw new Error(`Unknown weapon id ${weaponId}`);
    }
  }

  canShoot(time) {
    if (!this.definition) {
      return false;
    }
    if (this.isReloading) {
      return false;
    }
    if (!Number.isFinite(this.definition.magazineSize)) {
      return time >= this.lastShotTime + 1 / this.definition.fireRate;
    }
    if (this.ammoInMagazine <= 0) {
      return false;
    }
    return time >= this.lastShotTime + 1 / this.definition.fireRate;
  }

  shoot(time) {
    if (!this.canShoot(time)) {
      return false;
    }
    this.lastShotTime = time;
    if (Number.isFinite(this.definition.magazineSize)) {
      this.ammoInMagazine = Math.max(0, this.ammoInMagazine - 1);
    }
    return true;
  }

  startReload(time) {
    if (this.isReloading || !Number.isFinite(this.definition.magazineSize)) {
      return false;
    }
    if (this.ammoInMagazine >= this.definition.magazineSize) {
      return false;
    }
    if (this.reserveAmmo <= 0) {
      return false;
    }
    this.isReloading = true;
    this.reloadEndTime = time + this.definition.reloadTime;
    return true;
  }

  update(time) {
    if (this.isReloading && time >= this.reloadEndTime) {
      const need = this.definition.magazineSize - this.ammoInMagazine;
      const taken = Math.min(need, this.reserveAmmo);
      this.ammoInMagazine += taken;
      this.reserveAmmo -= taken;
      this.isReloading = false;
      return true;
    }
    return false;
  }

  refill() {
    this.ammoInMagazine = Number.isFinite(this.definition.magazineSize)
      ? this.definition.magazineSize
      : Infinity;
    this.reserveAmmo = this.definition.reserveAmmo;
    this.isReloading = false;
    this.reloadEndTime = 0;
  }

  toJSON() {
    return {
      id: this.weaponId,
      ammo: Number.isFinite(this.definition.magazineSize) ? this.ammoInMagazine : null,
      reserve: this.reserveAmmo,
      reloading: this.isReloading,
      reloadEnd: this.reloadEndTime
    };
  }
}
