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

export function intersectRaySphere(origin, direction, center, radius) {
  const oc = subtract(origin, center);
  const b = 2 * dot(direction, oc);
  const c = dot(oc, oc) - radius * radius;
  const discriminant = b * b - 4 * c;
  if (discriminant < 0) {
    return null;
  }
  const sqrtDisc = Math.sqrt(discriminant);
  const t0 = (-b - sqrtDisc) / 2;
  const t1 = (-b + sqrtDisc) / 2;
  const distance = t0 > 0 ? t0 : t1 > 0 ? t1 : null;
  return distance;
}

export function intersectRayVerticalCylinder(origin, direction, center, radius, minY, maxY) {
  const ox = origin.x - center.x;
  const oz = origin.z - center.z;
  const dx = direction.x;
  const dz = direction.z;
  const a = dx * dx + dz * dz;

  const checkSolution = (t) => {
    if (t == null || t <= 0) {
      return null;
    }
    const y = origin.y + direction.y * t;
    if (y < minY || y > maxY) {
      return null;
    }
    return t;
  };

  if (a < 1e-6) {
    const radialDistanceSq = ox * ox + oz * oz;
    if (radialDistanceSq > radius * radius) {
      return null;
    }
    const ty1 = (minY - origin.y) / direction.y;
    const ty2 = (maxY - origin.y) / direction.y;
    return checkSolution(Math.min(ty1, ty2)) ?? checkSolution(Math.max(ty1, ty2));
  }

  const b = 2 * (ox * dx + oz * dz);
  const c = ox * ox + oz * oz - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return null;
  }
  const sqrtDisc = Math.sqrt(discriminant);
  let t0 = (-b - sqrtDisc) / (2 * a);
  let t1 = (-b + sqrtDisc) / (2 * a);
  if (t0 > t1) {
    const temp = t0;
    t0 = t1;
    t1 = temp;
  }
  return checkSolution(t0) ?? checkSolution(t1);
}
