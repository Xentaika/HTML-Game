import {
  BUY_ZONE_CENTER,
  BUY_ZONE_RADIUS,
  MAX_HEALTH,
  PLAYER_EYE_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  RESPAWN_TIME,
  STARTING_MONEY
} from '../../shared/constants.js';
import { DefaultLoadout, WeaponDefinitions, WeaponId } from '../../shared/weapons.js';
import { clamp } from '../core/math.js';
import { WeaponState } from './WeaponState.js';

const MAX_PITCH = Math.PI / 2 - 0.1;

export class PlayerState {
  constructor(id, spawn) {
    this.id = id;
    this.spawnPoint = { ...spawn };
    this.position = { ...spawn };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.orientation = { yaw: 0, pitch: 0 };
    this.health = MAX_HEALTH;
    this.money = STARTING_MONEY;
    this.score = 0;
    this.kills = 0;
    this.deaths = 0;
    this.onGround = true;
    this.isAlive = true;
    this.respawnTimer = 0;
    this.lastProcessedInput = 0;
    this.lastAckTimestamp = Date.now();
    this.inputBuffer = [];
    this.loadout = new Map();
    this.activeWeaponId = WeaponId.GLOCK18;
    this.lastBuyTime = 0;
    this.isInBuyZone = false;

    this.initializeLoadout();
  }

  initializeLoadout() {
    DefaultLoadout.forEach((weaponId) => {
      this.grantWeapon(weaponId, { free: true });
    });
    if (!this.loadout.has(this.activeWeaponId)) {
      const [first] = DefaultLoadout;
      this.activeWeaponId = first;
    }
    this.refillWeapons();
  }

  grantWeapon(weaponId, { free = false } = {}) {
    const definition = WeaponDefinitions[weaponId];
    if (!definition) {
      return false;
    }
    if (!free && this.money < definition.price) {
      return false;
    }
    if (!free) {
      this.money -= definition.price;
    }
    const state = new WeaponState(weaponId);
    state.refill();
    this.loadout.set(weaponId, state);
    this.activeWeaponId = weaponId;
    return true;
  }

  hasWeapon(weaponId) {
    return this.loadout.has(weaponId);
  }

  getActiveWeapon() {
    return this.loadout.get(this.activeWeaponId) ?? null;
  }

  cycleWeapon(nextWeaponId) {
    if (nextWeaponId && this.loadout.has(nextWeaponId)) {
      this.activeWeaponId = nextWeaponId;
      return true;
    }
    return false;
  }

  enqueueInput(input) {
    if (!input || typeof input.sequence !== 'number') {
      return;
    }
    if (input.sequence <= this.lastProcessedInput) {
      return;
    }
    const normalized = {
      sequence: input.sequence,
      forward: clamp(Number(input.forward) || 0, -1, 1),
      right: clamp(Number(input.right) || 0, -1, 1),
      jump: Boolean(input.jump),
      yaw: typeof input.yaw === 'number' ? input.yaw : this.orientation.yaw,
      pitch: clamp(typeof input.pitch === 'number' ? input.pitch : this.orientation.pitch, -MAX_PITCH, MAX_PITCH),
      timestamp: typeof input.timestamp === 'number' ? input.timestamp : Date.now(),
      sprint: Boolean(input.sprint)
    };
    this.inputBuffer.push(normalized);
    this.orientation.yaw = normalized.yaw;
    this.orientation.pitch = normalized.pitch;
  }

  consumeInput() {
    if (this.inputBuffer.length > 0) {
      const next = this.inputBuffer.shift();
      this.lastProcessedInput = next.sequence;
      this.lastAckTimestamp = next.timestamp;
      this.orientation.yaw = next.yaw;
      this.orientation.pitch = next.pitch;
      return next;
    }
    return {
      sequence: this.lastProcessedInput,
      forward: 0,
      right: 0,
      jump: false,
      sprint: false,
      yaw: this.orientation.yaw,
      pitch: this.orientation.pitch,
      timestamp: this.lastAckTimestamp
    };
  }

  updateWeaponTimers(time) {
    this.loadout.forEach((weapon) => {
      weapon.update(time);
    });
  }

  startReload(time) {
    const weapon = this.getActiveWeapon();
    if (!weapon) {
      return false;
    }
    return weapon.startReload(time);
  }

  attemptShot(time) {
    const weapon = this.getActiveWeapon();
    if (!weapon) {
      return false;
    }
    return weapon.shoot(time);
  }

  takeDamage(amount) {
    if (!this.isAlive) {
      return false;
    }
    this.health = Math.max(0, this.health - amount);
    if (this.health === 0) {
      this.isAlive = false;
      this.deaths += 1;
      return true;
    }
    return false;
  }

  scheduleRespawn() {
    this.respawnTimer = RESPAWN_TIME;
  }

  updateRespawn(dt, respawns) {
    if (this.isAlive) {
      return false;
    }
    this.respawnTimer -= dt;
    if (this.respawnTimer <= 0) {
      const spawn = respawns[Math.floor(Math.random() * respawns.length)] ?? this.spawnPoint;
      this.position = { ...spawn };
      this.velocity = { x: 0, y: 0, z: 0 };
      this.orientation.pitch = 0;
      this.health = MAX_HEALTH;
      this.isAlive = true;
      this.respawnTimer = 0;
      this.refillWeapons();
      return true;
    }
    return false;
  }

  setBuyZoneState(time) {
    const dx = this.position.x - BUY_ZONE_CENTER.x;
    const dz = this.position.z - BUY_ZONE_CENTER.z;
    this.isInBuyZone = dx * dx + dz * dz <= BUY_ZONE_RADIUS * BUY_ZONE_RADIUS;
    if (this.isInBuyZone) {
      this.lastBuyTime = time;
    }
  }

  toSnapshot(time) {
    return {
      id: this.id,
      position: { ...this.position },
      velocity: { ...this.velocity },
      yaw: this.orientation.yaw,
      pitch: this.orientation.pitch,
      health: this.health,
      money: this.money,
      score: this.score,
      kills: this.kills,
      deaths: this.deaths,
      activeWeapon: this.activeWeaponId,
      weapons: Array.from(this.loadout.entries()).map(([weaponId, weapon]) => ({
        id: weaponId,
        ammo: weapon.toJSON().ammo,
        reserve: weapon.toJSON().reserve,
        reloading: weapon.isReloading,
        reloadEnd: weapon.reloadEndTime
      })),
      isAlive: this.isAlive,
      respawnTimer: this.isAlive ? 0 : this.respawnTimer,
      onGround: this.onGround,
      buyZone: this.isInBuyZone,
      lastProcessedInput: this.lastProcessedInput,
      serverTime: time
    };
  }

  refillWeapons() {
    this.loadout.forEach((weapon) => weapon.refill());
  }
}
