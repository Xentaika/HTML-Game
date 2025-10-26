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

    this.pointerSpeed = options.pointerSpeed ?? 0.6;
    this.maxDelta = Math.max(0, options.maxDelta ?? 1200);
    this.maxPolarAngle = MathUtils.clamp(options.maxPolarAngle ?? Math.PI, 0.1, Math.PI);
    this.minPolarAngle = MathUtils.clamp(options.minPolarAngle ?? 0, 0, this.maxPolarAngle);

    this._skipNextMouseEvent = false;

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

  update(delta) {
    // No smoothing update step is required. Keeping the method so external
    // callers can continue invoking update without side effects.
    void delta;
  }

  _handleMouseMove(event) {
    if (this.isLocked === false) {
      return;
    }
    if (this._skipNextMouseEvent) {
      this._skipNextMouseEvent = false;
      return;
    }

    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    const clampedX = MathUtils.clamp(movementX, -this.maxDelta, this.maxDelta);
    const clampedY = MathUtils.clamp(movementY, -this.maxDelta, this.maxDelta);

    const scale = 0.002 * this.pointerSpeed;

    _euler.setFromQuaternion(this.camera.quaternion);
    _euler.y -= clampedX * scale;
    _euler.x -= clampedY * scale;

    _euler.x = Math.max(HALF_PI - this.maxPolarAngle, Math.min(HALF_PI - this.minPolarAngle, _euler.x));

    this.camera.quaternion.setFromEuler(_euler);
    this.dispatchEvent(_changeEvent);
  }

  _handlePointerLockChange() {
    if (this.domElement.ownerDocument.pointerLockElement === this.domElement) {
      this.isLocked = true;
      this._skipNextMouseEvent = true;
      this.dispatchEvent(_lockEvent);
    } else {
      this.isLocked = false;
      this._skipNextMouseEvent = false;
      this.dispatchEvent(_unlockEvent);
    }
  }

  _handlePointerLockError() {
    console.error('SmoothPointerLockControls: Unable to use Pointer Lock API');
  }
}
