class ArenaCollider {
  constructor(position, scale) {
    const halfX = scale.x / 2;
    const halfY = scale.y / 2;
    const halfZ = scale.z / 2;

    this.min = {
      x: position.x - halfX,
      y: position.y - halfY,
      z: position.z - halfZ
    };
    this.max = {
      x: position.x + halfX,
      y: position.y + halfY,
      z: position.z + halfZ
    };
  }
}

function resolvePlayerCollisions(player, previousPosition, colliders, radius) {
  const top = player.position.y;
  const bottom = top - player.config.playerHeight;

  colliders.forEach((collider) => {
    if (top < collider.min.y || bottom > collider.max.y) {
      return;
    }

    const nearestX = Math.max(collider.min.x, Math.min(player.position.x, collider.max.x));
    const nearestZ = Math.max(collider.min.z, Math.min(player.position.z, collider.max.z));

    let deltaX = player.position.x - nearestX;
    let deltaZ = player.position.z - nearestZ;
    let distanceSq = deltaX * deltaX + deltaZ * deltaZ;

    const radiusSq = radius * radius;
    if (distanceSq >= radiusSq) {
      return;
    }

    if (distanceSq === 0) {
      deltaX = player.position.x - previousPosition.x;
      deltaZ = player.position.z - previousPosition.z;
      distanceSq = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSq === 0) {
        deltaX = 1;
        deltaZ = 0;
        distanceSq = 1;
      }
    }

    let distance = Math.sqrt(distanceSq);
    if (distance === 0) {
      distance = 1;
    }

    const penetration = radius - distance;
    const normalX = deltaX / distance;
    const normalZ = deltaZ / distance;

    player.position.x += normalX * penetration;
    player.position.z += normalZ * penetration;

    if ((normalX > 0 && player.velocity.x < 0) || (normalX < 0 && player.velocity.x > 0)) {
      player.velocity.x = 0;
    }
    if ((normalZ > 0 && player.velocity.z < 0) || (normalZ < 0 && player.velocity.z > 0)) {
      player.velocity.z = 0;
    }
  });
}

module.exports = { ArenaCollider, resolvePlayerCollisions };
