class Character {
  constructor({
    name = 'Оперативник',
    maxHealth = 100,
    startingWallet = 800,
    loadout = ['knife', 'glock18']
  } = {}) {
    this.name = name;
    this.maxHealth = maxHealth;
    this.startingWallet = startingWallet;
    this.loadout = loadout;
  }
}

module.exports = { Character };
