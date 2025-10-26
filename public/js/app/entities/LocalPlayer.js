import * as THREE from 'three';
import { MovementSimulator } from '../core/MovementSimulator.js';
import { PLAYER_EYE_HEIGHT, BUY_ZONE_CENTER, BUY_ZONE_RADIUS } from '/shared/constants.js';
import { WeaponDefinitions, DefaultLoadout } from '../data/weapons.js';
import { WeaponViewModel } from './WeaponViewModel.js';

export class LocalPlayer {
  constructor(camera, arena) {
    this.camera = camera;
    this.state = {
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      yaw: 0,
      pitch: 0,
      onGround: true,
      health: 100,
      money: 0,
      score: 0,
      isAlive: true,
      activeWeapon: null,
      weapons: new Map(),
      respawnTimer: 0,
      buyZone: false
    };
    this.simulator = new MovementSimulator(arena);
    this.viewModel = new WeaponViewModel(camera);
    this.pendingInputs = [];
    this.lastShotTime = -Infinity;
    this.reloadState = false;
  }

  reset(arena) {
    this.simulator = new MovementSimulator(arena);
    this.state.position.set(0, 0, 0);
    this.state.velocity.set(0, 0, 0);
    this.state.yaw = 0;
    this.state.pitch = 0;
    this.state.health = 100;
    this.state.money = 0;
    this.state.score = 0;
    this.state.onGround = true;
    this.state.isAlive = true;
    this.state.weapons.clear();
    DefaultLoadout.forEach((id) => {
      this.state.weapons.set(id, {
        ammo: WeaponDefinitions[id].magazineSize,
        reserve: WeaponDefinitions[id].reserveAmmo,
        reloading: false,
        reloadEnd: 0
      });
    });
    this.state.activeWeapon = DefaultLoadout[DefaultLoadout.length - 1];
    this.lastShotTime = -Infinity;
    this.reloadState = false;
  }

  updateCamera() {
    this.camera.position.copy(this.state.position);
    this.camera.position.y += PLAYER_EYE_HEIGHT;
    this.camera.rotation.set(this.state.pitch, this.state.yaw, 0, 'YXZ');
  }

  syncOrientation({ yaw, pitch }) {
    if (typeof yaw === 'number') {
      this.state.yaw = yaw;
    }
    if (typeof pitch === 'number') {
      this.state.pitch = pitch;
    }
    this.updateCamera();
  }

  simulate(input, dt) {
    if (!this.state.isAlive) {
      return;
    }
    this.state.yaw = input.yaw;
    this.state.pitch = input.pitch;
    this.simulator.simulate(this.state, input, dt);
    this.updateCamera();
    this.state.buyZone = this.computeBuyZone();
  }

  computeBuyZone() {
    const dx = this.state.position.x - BUY_ZONE_CENTER.x;
    const dz = this.state.position.z - BUY_ZONE_CENTER.z;
    return dx * dx + dz * dz <= BUY_ZONE_RADIUS * BUY_ZONE_RADIUS;
  }

  registerPendingInput(input) {
    this.pendingInputs.push(input);
  }

  reconcile(snapshot, dt) {
    this.state.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
    this.state.velocity.set(snapshot.velocity.x, snapshot.velocity.y, snapshot.velocity.z);
    this.state.yaw = snapshot.yaw;
    this.state.pitch = snapshot.pitch;
    this.state.health = snapshot.health;
    this.state.money = snapshot.money;
    this.state.score = snapshot.score;
    this.state.isAlive = snapshot.isAlive;
    this.state.onGround = snapshot.onGround;
    this.state.activeWeapon = snapshot.activeWeapon;
    this.state.respawnTimer = snapshot.respawnTimer;
    this.state.buyZone = snapshot.buyZone;

    this.state.weapons.clear();
    snapshot.weapons.forEach((weapon) => {
      this.state.weapons.set(weapon.id, {
        ammo: weapon.ammo,
        reserve: weapon.reserve,
        reloading: weapon.reloading,
        reloadEnd: weapon.reloadEnd
      });
    });

    this.updateCamera();
    this.viewModel.equip(snapshot.activeWeapon);
    const activeState = this.getActiveWeaponState();
    this.viewModel.updateAmmo(activeState);
    this.reloadState = activeState?.reloading ?? false;
    this.viewModel.setReloading(this.reloadState);
    this.pendingInputs = this.pendingInputs.filter((input) => input.sequence > snapshot.lastProcessedInput);
    this.pendingInputs.forEach((input) => {
      this.simulate(input, dt);
    });
  }

  getActiveWeaponState() {
    return this.state.weapons.get(this.state.activeWeapon) ?? null;
  }

  canShoot(time) {
    const definition = WeaponDefinitions[this.state.activeWeapon];
    if (!definition) {
      return false;
    }
    if (this.reloadState) {
      return false;
    }
    const state = this.getActiveWeaponState();
    if (state && state.ammo === 0 && Number.isFinite(state.ammo)) {
      return false;
    }
    const nextAvailable = this.lastShotTime + 1 / definition.fireRate;
    return time >= nextAvailable;
  }

  applyShotFeedback(result) {
    const now = performance.now() / 1000;
    this.lastShotTime = now;
    if (!result || !result.hit) {
      this.viewModel.pulseMuzzle();
    } else {
      this.viewModel.pulseMuzzle({ hit: true, headshot: result.headshot });
    }
    const weapon = this.getActiveWeaponState();
    if (weapon && Number.isFinite(weapon.ammo) && weapon.ammo > 0) {
      weapon.ammo = Math.max(0, weapon.ammo - 1);
      this.viewModel.updateAmmo(weapon);
    }
    this.viewModel.kick();
  }

  setReloading(isReloading) {
    this.reloadState = isReloading;
    this.viewModel.setReloading(isReloading);
  }

  update(delta) {
    this.viewModel.update(delta, this.state);
  }
}
