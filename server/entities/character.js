const { Weapon } = require('./weapon');

class Character {
  constructor({ name = 'Recruit', maxHealth = 100, loadout } = {}) {
    this.name = name;
    this.maxHealth = maxHealth;
    this.loadout = loadout || { primary: new Weapon({}) };
  }
}

module.exports = { Character };
