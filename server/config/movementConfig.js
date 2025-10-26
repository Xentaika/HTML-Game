class MovementConfig {
  constructor() {
    this.tickRate = 128;
    this.fixedDelta = 1 / this.tickRate;
    this.gravity = 30;
    this.playerRadius = 0.6;
    this.playerHeight = 1.6;
    this.groundLevel = 1.6;
    this.runSpeed = 20;
    this.walkSpeed = 12;
    this.acceleration = 240;
    this.friction = 32;
    this.jumpForce = 6.2;
  }
}

module.exports = { MovementConfig };
