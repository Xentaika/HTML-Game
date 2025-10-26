class Weapon {
  constructor({ name = 'Sidearm', magazineSize = 12, reserve = 60, fireRate = 0.22, reloadDuration = 1.4, bodyDamage = 25, headshotDamage = 100 } = {}) {
    this.name = name;
    this.magazineSize = magazineSize;
    this.reserve = reserve;
    this.fireRate = fireRate;
    this.reloadDuration = reloadDuration;
    this.bodyDamage = bodyDamage;
    this.headshotDamage = headshotDamage;
  }
}

module.exports = { Weapon };
