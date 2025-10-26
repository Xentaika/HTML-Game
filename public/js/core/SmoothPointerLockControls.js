import { Euler, EventDispatcher, MathUtils, Vector3 } from 'three';

const _euler = new Euler(0, 0, 0, 'YXZ');
const _vector = new Vector3();

const _changeEvent = { type: 'change' };
const _lockEvent = { type: 'lock' };
const _unlockEvent = { type: 'unlock' };

const HALF_PI = Math.PI / 2;

export class SmoothPointerLockControls extends EventDispatcher {
  constructor(camera, domElement, options = {}) {
    super();

    this.camera = camera;
    this.domElement = domElement;

    this.isLocked = false;
    this.minPolarAngle = 0;
    this.maxPolarAngle = Math.PI;

    this.pointerSpeed = options.pointerSpeed ?? 0.2;
    this.smoothingFactor = MathUtils.clamp(options.smoothingFactor ?? 0.2, 0.01, 1);
    this.maxRotationStep = options.maxRotationStep ?? 0.05;

    this._pendingDeltaX = 0;
    this._pendingDeltaY = 0;

    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onPointerlockChange = this._handlePointerLockChange.bind(this);
    this._onPointerlockError = this._handlePointerLockError.bind(this);

    this.connect();
  }

  connect() {
    const ownerDocument = this.domElement.ownerDocument;
    ownerDocument.addEventListener('mousemove', this._onMouseMove);
    ownerDocument.addEventListener('pointerlockchange', this._onPointerlockChange);
    ownerDocument.addEventListener('pointerlockerror', this._onPointerlockError);
  }

  disconnect() {
    const ownerDocument = this.domElement.ownerDocument;
    ownerDocument.removeEventListener('mousemove', this._onMouseMove);
    ownerDocument.removeEventListener('pointerlockchange', this._onPointerlockChange);
    ownerDocument.removeEventListener('pointerlockerror', this._onPointerlockError);
  }

  dispose() {
    this.disconnect();
  }

  getObject() {
    return this.camera;
  }

  getDirection(v) {
    return v.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
  }

  moveForward(distance) {
    _vector.setFromMatrixColumn(this.camera.matrix, 0);
    _vector.crossVectors(this.camera.up, _vector);
    this.camera.position.addScaledVector(_vector, distance);
  }

  moveRight(distance) {
    _vector.setFromMatrixColumn(this.camera.matrix, 0);
    this.camera.position.addScaledVector(_vector, distance);
  }

  lock() {
    this.domElement.requestPointerLock();
  }

  unlock() {
    this.domElement.ownerDocument.exitPointerLock();
  }

  resetSmoothing() {
    this._pendingDeltaX = 0;
    this._pendingDeltaY = 0;
  }

  update(delta) {
    if (!this.isLocked) {
      this.resetSmoothing();
      return;
    }

    const smoothing = 1 - Math.exp(-this.smoothingFactor * (delta * 60));
    if (smoothing <= 0) {
      return;
    }

    let applyX = this._pendingDeltaX * smoothing;
    let applyY = this._pendingDeltaY * smoothing;

    applyX = MathUtils.clamp(applyX, -this.maxRotationStep, this.maxRotationStep);
    applyY = MathUtils.clamp(applyY, -this.maxRotationStep, this.maxRotationStep);

    if (Math.abs(applyX) < 1e-7 && Math.abs(applyY) < 1e-7) {
      return;
    }

    this._pendingDeltaX -= applyX;
    this._pendingDeltaY -= applyY;

    _euler.setFromQuaternion(this.camera.quaternion);
    _euler.y -= applyX;
    _euler.x -= applyY;

    _euler.x = Math.max(HALF_PI - this.maxPolarAngle, Math.min(HALF_PI - this.minPolarAngle, _euler.x));

    this.camera.quaternion.setFromEuler(_euler);
    this.dispatchEvent(_changeEvent);
  }

  _handleMouseMove(event) {
    if (this.isLocked === false) {
      return;
    }
    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    const scale = 0.002 * this.pointerSpeed;
    this._pendingDeltaX += movementX * scale;
    this._pendingDeltaY += movementY * scale;
  }

  _handlePointerLockChange() {
    if (this.domElement.ownerDocument.pointerLockElement === this.domElement) {
      this.isLocked = true;
      this.resetSmoothing();
      this.dispatchEvent(_lockEvent);
    } else {
      this.isLocked = false;
      this.resetSmoothing();
      this.dispatchEvent(_unlockEvent);
    }
  }

  _handlePointerLockError() {
    console.error('SmoothPointerLockControls: Unable to use Pointer Lock API');
  }
}
