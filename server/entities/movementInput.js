class MovementInput {
  constructor() {
    this.forward = false;
    this.backward = false;
    this.left = false;
    this.right = false;
    this.walk = false;
    this.jump = false;
  }

  setFromPayload(payload) {
    this.forward = Boolean(payload.forward);
    this.backward = Boolean(payload.backward);
    this.left = Boolean(payload.left);
    this.right = Boolean(payload.right);
    this.walk = Boolean(payload.walk);
    if (payload.jump) {
      this.jump = true;
    }
  }

  consumeJump() {
    const wantsJump = this.jump;
    this.jump = false;
    return wantsJump;
  }
}

module.exports = { MovementInput };
