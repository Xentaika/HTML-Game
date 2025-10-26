import * as THREE from 'three';

const SLOT_KEYS = {
  Digit1: 'melee',
  Digit2: 'secondary',
  Digit3: 'primary',
  Digit4: 'primary'
};

export class InputController {
  constructor(controls, hud) {
    this.controls = controls;
    this.hud = hud;
    this.keys = {};
    this.pointerLocked = false;
    this.pendingJump = false;
    this.orientationCache = new THREE.Quaternion();

    this.onInput = () => {};
    this.onFire = () => {};
    this.onReload = () => {};
    this.onConnectRequest = () => {};
    this.onToggleBuy = () => {};
    this.onSwitchWeapon = () => {};

    this.bindEvents();
  }

  bindEvents() {
    this.controls.addEventListener('lock', () => {
      this.pointerLocked = true;
      this.hud?.overlay?.classList.add('pointer-locked');
    });

    this.controls.addEventListener('unlock', () => {
      this.pointerLocked = false;
      this.hud?.overlay?.classList.remove('pointer-locked');
    });

    document.addEventListener('keydown', (event) => {
      if (event.repeat) {
        return;
      }
      this.keys[event.code] = true;
      if (event.code === 'Space') {
        this.pendingJump = true;
      }
      if (event.code === 'KeyR') {
        event.preventDefault();
        this.onReload();
      }
      if (event.code === 'KeyB') {
        event.preventDefault();
        this.onToggleBuy();
      }
      if (event.code in SLOT_KEYS) {
        event.preventDefault();
        this.onSwitchWeapon(SLOT_KEYS[event.code]);
      }
      this.onInput();
    });

    document.addEventListener('keyup', (event) => {
      this.keys[event.code] = false;
      this.onInput();
    });

    document.addEventListener('mousedown', (event) => {
      if (event.button !== 0) {
        return;
      }
      if (!this.pointerLocked) {
        this.onConnectRequest();
        this.controls.lock();
      } else {
        this.onFire();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.pointerLocked) {
        document.exitPointerLock();
      }
    });
  }

  buildInputPayload() {
    const quaternion = this.controls.getObject().quaternion;
    return {
      ...this.getMovementState(),
      quaternion: { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w }
    };
  }

  getMovementState() {
    return {
      forward: this.keys['KeyW'] || false,
      backward: this.keys['KeyS'] || false,
      left: this.keys['KeyA'] || false,
      right: this.keys['KeyD'] || false,
      walk: Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']),
      jump: this.pendingJump
    };
  }

  trackOrientationChanges() {
    const quaternion = this.controls.getObject().quaternion;
    const threshold = 0.00008;
    const changed =
      Math.abs(quaternion.x - this.orientationCache.x) > threshold ||
      Math.abs(quaternion.y - this.orientationCache.y) > threshold ||
      Math.abs(quaternion.z - this.orientationCache.z) > threshold ||
      Math.abs(quaternion.w - this.orientationCache.w) > threshold;
    if (changed) {
      this.onInput();
    }
  }

  acknowledgePayload(payload) {
    this.pendingJump = false;
    this.orientationCache.set(payload.quaternion.x, payload.quaternion.y, payload.quaternion.z, payload.quaternion.w);
  }

  consumeJump() {
    const wantsJump = this.pendingJump;
    this.pendingJump = false;
    return wantsJump;
  }
}
