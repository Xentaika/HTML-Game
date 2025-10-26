class MovementInput {
  constructor() {
    this.forward = false;
    this.backward = false;
    this.left = false;
    this.right = false;
    this.walk = false;
    this.jump = false;
    this.sequence = 0;
    this.timestamp = 0;
  }

  setFromPayload(payload) {
    if (!payload) {
      return;
    }
    this.forward = Boolean(payload.forward);
    this.backward = Boolean(payload.backward);
    this.left = Boolean(payload.left);
    this.right = Boolean(payload.right);
    this.walk = Boolean(payload.walk);
    if (payload.jump) {
      this.jump = true;
    }
    if (typeof payload.sequence === 'number') {
      this.sequence = payload.sequence;
    }
    if (typeof payload.timestamp === 'number') {
      this.timestamp = payload.timestamp;
    }
  }

  consumeJump() {
    const wantsJump = this.jump;
    this.jump = false;
    return wantsJump;
  }
}

module.exports = { MovementInput };
