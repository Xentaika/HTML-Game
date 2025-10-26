export const WeaponSlot = {
  melee: 'melee',
  sidearm: 'sidearm',
  smg: 'smg',
  rifle: 'rifle',
  sniper: 'sniper'
};

export const WeaponId = {
  KNIFE: 'knife',
  GLOCK18: 'glock18',
  DEAGLE: 'deagle',
  MP9: 'mp9',
  AK47: 'ak47',
  M4A1: 'm4a1',
  AWP: 'awp'
};

export const WeaponDefinitions = {
  [WeaponId.KNIFE]: {
    id: WeaponId.KNIFE,
    name: 'Нож',
    slot: WeaponSlot.melee,
    price: 0,
    magazineSize: Infinity,
    reserveAmmo: 0,
    fireRate: 1.8,
    reloadTime: 0,
    equipTime: 0.4,
    damage: 50,
    headshotMultiplier: 2.1,
    range: 1.5,
    recoilKick: 0,
    spread: 0,
    movementPenalty: 0,
    model: {
      length: 0.9,
      thickness: 0.08,
      color: 0xb0b0b0,
      accentColor: 0x1f1f1f
    }
  },
  [WeaponId.GLOCK18]: {
    id: WeaponId.GLOCK18,
    name: 'Glock-18',
    slot: WeaponSlot.sidearm,
    price: 200,
    magazineSize: 20,
    reserveAmmo: 120,
    fireRate: 6.67,
    reloadTime: 2.3,
    equipTime: 0.6,
    damage: 28,
    headshotMultiplier: 3.1,
    range: 55,
    recoilKick: 0.6,
    spread: 0.011,
    movementPenalty: 0.02,
    model: {
      length: 0.6,
      thickness: 0.14,
      color: 0x303030,
      accentColor: 0x606060
    }
  },
  [WeaponId.DEAGLE]: {
    id: WeaponId.DEAGLE,
    name: 'Desert Eagle',
    slot: WeaponSlot.sidearm,
    price: 650,
    magazineSize: 7,
    reserveAmmo: 35,
    fireRate: 4.2,
    reloadTime: 2.2,
    equipTime: 0.65,
    damage: 53,
    headshotMultiplier: 3.5,
    range: 90,
    recoilKick: 1.4,
    spread: 0.008,
    movementPenalty: 0.03,
    model: {
      length: 0.72,
      thickness: 0.16,
      color: 0x2b2b2b,
      accentColor: 0xc0a060
    }
  },
  [WeaponId.MP9]: {
    id: WeaponId.MP9,
    name: 'MP9',
    slot: WeaponSlot.smg,
    price: 1250,
    magazineSize: 30,
    reserveAmmo: 120,
    fireRate: 14.28,
    reloadTime: 2.1,
    equipTime: 0.75,
    damage: 26,
    headshotMultiplier: 2.6,
    range: 70,
    recoilKick: 0.9,
    spread: 0.02,
    movementPenalty: 0.05,
    model: {
      length: 0.9,
      thickness: 0.22,
      color: 0x11161c,
      accentColor: 0x1e2a38
    }
  },
  [WeaponId.AK47]: {
    id: WeaponId.AK47,
    name: 'AK-47',
    slot: WeaponSlot.rifle,
    price: 2700,
    magazineSize: 30,
    reserveAmmo: 90,
    fireRate: 10,
    reloadTime: 2.5,
    equipTime: 0.85,
    damage: 36,
    headshotMultiplier: 4.1,
    range: 95,
    recoilKick: 1.55,
    spread: 0.013,
    movementPenalty: 0.06,
    model: {
      length: 1.05,
      thickness: 0.24,
      color: 0x2c1a0f,
      accentColor: 0x734d27
    }
  },
  [WeaponId.M4A1]: {
    id: WeaponId.M4A1,
    name: 'M4A1',
    slot: WeaponSlot.rifle,
    price: 3100,
    magazineSize: 30,
    reserveAmmo: 90,
    fireRate: 11.1,
    reloadTime: 2.4,
    equipTime: 0.82,
    damage: 33,
    headshotMultiplier: 3.6,
    range: 95,
    recoilKick: 1.3,
    spread: 0.012,
    movementPenalty: 0.055,
    model: {
      length: 1.0,
      thickness: 0.24,
      color: 0x1d232d,
      accentColor: 0x3f4a59
    }
  },
  [WeaponId.AWP]: {
    id: WeaponId.AWP,
    name: 'AWP',
    slot: WeaponSlot.sniper,
    price: 4750,
    magazineSize: 5,
    reserveAmmo: 30,
    fireRate: 0.68,
    reloadTime: 3.6,
    equipTime: 1.0,
    damage: 115,
    headshotMultiplier: 3.0,
    range: 150,
    recoilKick: 3.5,
    spread: 0.003,
    movementPenalty: 0.08,
    model: {
      length: 1.25,
      thickness: 0.28,
      color: 0x1a3b1f,
      accentColor: 0x2d5f31
    }
  }
};

export const DefaultLoadout = [WeaponId.KNIFE, WeaponId.GLOCK18];

export const WeaponShopOrder = [
  WeaponId.GLOCK18,
  WeaponId.DEAGLE,
  WeaponId.MP9,
  WeaponId.AK47,
  WeaponId.M4A1,
  WeaponId.AWP
];
