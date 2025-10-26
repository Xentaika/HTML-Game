export class InputManager {
  constructor({ onShoot, onReload, onToggleBuy, onNextWeapon, onPrevWeapon, onSelectWeapon }) {
    this.keys = new Map();
    this.sequence = 0;
    this.pendingJump = false;
    this.mouseDown = false;

    this.callbacks = {
      shoot: onShoot,
      reload: onReload,
      toggleBuy: onToggleBuy,
      nextWeapon: onNextWeapon,
      prevWeapon: onPrevWeapon,
      selectWeapon: onSelectWeapon
    };

    document.addEventListener('keydown', (event) => this.handleKeyDown(event));
    document.addEventListener('keyup', (event) => this.handleKeyUp(event));
    document.addEventListener('mousedown', (event) => this.handleMouseDown(event));
    document.addEventListener('mouseup', () => this.handleMouseUp());
  }

  handleMouseDown(event) {
    if (event.button === 0) {
      this.mouseDown = true;
      if (typeof this.callbacks.shoot === 'function') {
        this.callbacks.shoot(true);
      }
    }
  }

  handleMouseUp() {
    this.mouseDown = false;
    if (typeof this.callbacks.shoot === 'function') {
      this.callbacks.shoot(false);
    }
  }

  handleKeyDown(event) {
    if (event.repeat) {
      return;
    }
    this.keys.set(event.code, true);

    switch (event.code) {
      case 'Space':
        event.preventDefault();
        this.pendingJump = true;
        break;
      case 'KeyR':
        if (typeof this.callbacks.reload === 'function') {
          this.callbacks.reload();
        }
        break;
      case 'KeyB':
        event.preventDefault();
        if (typeof this.callbacks.toggleBuy === 'function') {
          this.callbacks.toggleBuy();
        }
        break;
      case 'KeyQ':
        if (typeof this.callbacks.prevWeapon === 'function') {
          this.callbacks.prevWeapon();
        }
        break;
      case 'KeyE':
        if (typeof this.callbacks.nextWeapon === 'function') {
          this.callbacks.nextWeapon();
        }
        break;
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
      case 'Digit4':
      case 'Digit5':
      case 'Digit6':
      case 'Digit7':
        if (typeof this.callbacks.selectWeapon === 'function') {
          const slot = Number(event.code.replace('Digit', ''));
          this.callbacks.selectWeapon(slot);
        }
        break;
      default:
        break;
    }
  }

  handleKeyUp(event) {
    this.keys.set(event.code, false);
  }

  buildInputPayload({ yaw, pitch }) {
    const forward = (this.isKeyDown('KeyW') ? 1 : 0) + (this.isKeyDown('KeyS') ? -1 : 0);
    const right = (this.isKeyDown('KeyD') ? 1 : 0) + (this.isKeyDown('KeyA') ? -1 : 0);
    const jump = this.pendingJump;
    this.pendingJump = false;
    this.sequence += 1;

    return {
      sequence: this.sequence,
      forward,
      right,
      jump,
      yaw,
      pitch,
      timestamp: performance.now()
    };
  }

  isKeyDown(code) {
    return this.keys.get(code) === true;
  }
}
