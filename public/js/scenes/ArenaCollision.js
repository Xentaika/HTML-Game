import * as THREE from 'three';

const COLLIDER_DATA = [
  { position: new THREE.Vector3(0, 2, -12), size: new THREE.Vector3(6, 4, 4) },
  { position: new THREE.Vector3(-10, 1.6, 6), size: new THREE.Vector3(8, 3, 4) },
  { position: new THREE.Vector3(12, 2.8, 10), size: new THREE.Vector3(6, 5, 4) },
  { position: new THREE.Vector3(-14, 2.5, -8), size: new THREE.Vector3(5, 5, 5) }
];

export const ARENA_COLLIDERS = COLLIDER_DATA.map(({ position, size }) => {
  const half = size.clone().multiplyScalar(0.5);
  return {
    min: position.clone().sub(half),
    max: position.clone().add(half)
  };
});

export function resolveCollisions(position, previous, velocity, height, radius) {
  const top = position.y;
  const bottom = top - height;

  ARENA_COLLIDERS.forEach((collider) => {
    if (top < collider.min.y || bottom > collider.max.y) {
      return;
    }
    const nearestX = Math.max(collider.min.x, Math.min(position.x, collider.max.x));
    const nearestZ = Math.max(collider.min.z, Math.min(position.z, collider.max.z));

    let deltaX = position.x - nearestX;
    let deltaZ = position.z - nearestZ;
    let distanceSq = deltaX * deltaX + deltaZ * deltaZ;
    const radiusSq = radius * radius;
    if (distanceSq >= radiusSq) {
      return;
    }

    if (distanceSq === 0) {
      deltaX = position.x - previous.x;
      deltaZ = position.z - previous.z;
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

    position.x += normalX * penetration;
    position.z += normalZ * penetration;

    if ((normalX > 0 && velocity.x < 0) || (normalX < 0 && velocity.x > 0)) {
      velocity.x = 0;
    }
    if ((normalZ > 0 && velocity.z < 0) || (normalZ < 0 && velocity.z > 0)) {
      velocity.z = 0;
    }
  });
}
