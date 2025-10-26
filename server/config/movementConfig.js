class MovementConfig {
  constructor() {
    this.tickRate = 64;
    this.fixedDelta = 1 / this.tickRate;
    this.gravity = 30;
    this.playerRadius = 0.6;
    this.playerHeight = 1.6;
    this.groundLevel = 1.6;
    this.runSpeed = 7.2;
    this.walkSpeed = 4.2;
    this.acceleration = 120;
    this.friction = 26;
    this.jumpForce = 5.8;
  }
}

module.exports = { MovementConfig };
