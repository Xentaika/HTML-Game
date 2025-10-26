const path = require('path');
const fs = require('fs');

function loadWeaponTemplates() {
  const filePath = path.join(__dirname, '..', '..', 'shared', 'weapons.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  return data;
}

const WEAPON_TEMPLATES = loadWeaponTemplates();

function createWeapon(id) {
  const template = WEAPON_TEMPLATES[id];
  if (!template) {
    throw new Error(`Unknown weapon template: ${id}`);
  }
  const { Weapon } = require('../entities/weapon');
  return new Weapon(id, template);
}

module.exports = {
  WEAPON_TEMPLATES,
  createWeapon
};
