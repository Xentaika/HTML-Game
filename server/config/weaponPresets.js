const WEAPON_PRESETS = {
  knife: {
    id: 'knife',
    name: 'Knife',
    slot: 'melee',
    price: 0,
    magazineSize: Infinity,
    reserve: Infinity,
    fireRate: 0.5,
    reloadDuration: 0,
    bodyDamage: 40,
    headshotDamage: 90,
    range: 2.4
  },
  glock18: {
    id: 'glock18',
    name: 'Glock-18',
    slot: 'secondary',
    price: 200,
    magazineSize: 20,
    reserve: 120,
    fireRate: 0.12,
    reloadDuration: 2.1,
    bodyDamage: 28,
    headshotDamage: 112,
    range: 70
  },
  deagle: {
    id: 'deagle',
    name: 'Desert Eagle',
    slot: 'secondary',
    price: 650,
    magazineSize: 7,
    reserve: 35,
    fireRate: 0.3,
    reloadDuration: 2.7,
    bodyDamage: 53,
    headshotDamage: 215,
    range: 80
  },
  mp9: {
    id: 'mp9',
    name: 'MP-9',
    slot: 'primary',
    price: 1250,
    magazineSize: 30,
    reserve: 120,
    fireRate: 0.066,
    reloadDuration: 2.2,
    bodyDamage: 26,
    headshotDamage: 104,
    range: 65
  },
  ak47: {
    id: 'ak47',
    name: 'AK-47',
    slot: 'primary',
    price: 2700,
    magazineSize: 30,
    reserve: 90,
    fireRate: 0.1,
    reloadDuration: 2.5,
    bodyDamage: 36,
    headshotDamage: 143,
    range: 80
  },
  m4a1: {
    id: 'm4a1',
    name: 'M4A1',
    slot: 'primary',
    price: 3100,
    magazineSize: 30,
    reserve: 90,
    fireRate: 0.09,
    reloadDuration: 2.4,
    bodyDamage: 33,
    headshotDamage: 132,
    range: 80
  },
  awp: {
    id: 'awp',
    name: 'AWP',
    slot: 'primary',
    price: 4750,
    magazineSize: 5,
    reserve: 15,
    fireRate: 1.45,
    reloadDuration: 3.7,
    bodyDamage: 115,
    headshotDamage: 459,
    range: 110
  }
};

const DEFAULT_LOADOUT = ['knife', 'glock18'];

module.exports = { WEAPON_PRESETS, DEFAULT_LOADOUT };
