function approach(current, target, maxDelta) {
  if (current < target) {
    return Math.min(current + maxDelta, target);
  }
  if (current > target) {
    return Math.max(current - maxDelta, target);
  }
  return target;
}

function normalize(vec) {
  const length = Math.hypot(vec.x, vec.y, vec.z);
  if (length === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: vec.x / length, y: vec.y / length, z: vec.z / length };
}

function distancePointToLine(point, origin, direction) {
  const px = point.x - origin.x;
  const py = point.y - origin.y;
  const pz = point.z - origin.z;
  const proj = px * direction.x + py * direction.y + pz * direction.z;
  const closestX = origin.x + direction.x * proj;
  const closestY = origin.y + direction.y * proj;
  const closestZ = origin.z + direction.z * proj;
  const dx = point.x - closestX;
  const dy = point.y - closestY;
  const dz = point.z - closestZ;
  return { distance: Math.hypot(dx, dy, dz), alongRay: proj };
}

module.exports = { approach, normalize, distancePointToLine };
