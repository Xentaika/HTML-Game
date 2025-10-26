export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function length(vec) {
  return Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
}

export function normalize(vec) {
  const len = length(vec);
  if (len === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: vec.x / len, y: vec.y / len, z: vec.z / len };
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scale(vec, scalar) {
  return { x: vec.x * scalar, y: vec.y * scalar, z: vec.z * scalar };
}

export function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function quaternionToDirection(quaternion, pitchFactor = 1) {
  const { x, y, z, w } = quaternion;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;

  const dir = {
    x: 2 * (xz + wy),
    y: 2 * (yz - wx) * pitchFactor,
    z: 1 - 2 * (xx + yy)
  };
  return normalize(dir);
}

export function quaternionFromEuler(yaw, pitch) {
  const cy = Math.cos(yaw * 0.5);
  const sy = Math.sin(yaw * 0.5);
  const cp = Math.cos(pitch * 0.5);
  const sp = Math.sin(pitch * 0.5);

  return {
    x: sp * cy,
    y: 0,
    z: -sp * sy,
    w: cp * cy
  };
}

export function distancePointToLine(point, origin, direction) {
  const toPoint = subtract(point, origin);
  const alongRay = dot(toPoint, direction);
  const closestPoint = add(origin, scale(direction, alongRay));
  const diff = subtract(point, closestPoint);
  const distSquared = dot(diff, diff);
  return {
    distance: Math.sqrt(Math.max(distSquared, 0)),
    alongRay
  };
}

export function clampMagnitude(vec, maxLength) {
  const len = length(vec);
  if (len <= maxLength || len === 0) {
    return { ...vec };
  }
  const scaleFactor = maxLength / len;
  return scale(vec, scaleFactor);
}
