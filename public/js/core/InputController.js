import * as THREE from 'three';

export class InputController {
  constructor(controls, hud) {
    this.controls = controls;
    this.hud = hud;
    this.keys = {};
    this.pointerLocked = false;
    this.pendingJump = false;
    this.inputAccumulator = 0;
    this.orientationCache = new THREE.Quaternion();
    this.onInput = () => {};
    this.onFire = () => {};
    this.onReload = () => {};
    this.onConnectRequest = () => {};
    this.bindEvents();
  }

  bindEvents() {
    document.addEventListener('keydown', (event) => {
      if (event.repeat) {
        return;
      }
      this.keys[event.code] = true;
      if (event.code === 'Space') {
        this.pendingJump = true;
      }
      if (event.code === 'KeyR') {
        this.onReload();
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

    this.controls.addEventListener('lock', () => {
      this.pointerLocked = true;
      if (this.hud.overlay) {
        this.hud.overlay.style.pointerEvents = 'none';
      }
    });

    this.controls.addEventListener('unlock', () => {
      this.pointerLocked = false;
      if (this.hud.overlay) {
        this.hud.overlay.style.pointerEvents = 'auto';
      }
      this.hud.toggleStartPrompt(true);
    });
  }

  buildInputPayload() {
    const quaternion = this.controls.getObject().quaternion;
    return {
      forward: this.keys['KeyW'] || false,
      backward: this.keys['KeyS'] || false,
      left: this.keys['KeyA'] || false,
      right: this.keys['KeyD'] || false,
      walk: Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']),
      jump: this.pendingJump,
      quaternion: {
        x: quaternion.x,
        y: quaternion.y,
        z: quaternion.z,
        w: quaternion.w
      }
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
}
