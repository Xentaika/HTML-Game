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

export function raySphereIntersection(origin, direction, center, radius, maxDistance = Infinity) {
  const m = subtract(origin, center);
  const b = dot(m, direction);
  const c = dot(m, m) - radius * radius;

  if (c > 0 && b > 0) {
    return null;
  }

  const discriminant = b * b - c;
  if (discriminant < 0) {
    return null;
  }

  const sqrtDisc = Math.sqrt(discriminant);
  let t = -b - sqrtDisc;
  if (t < 0) {
    t = -b + sqrtDisc;
  }
  if (t < 0 || t > maxDistance) {
    return null;
  }
  return t;
}

export function rayCapsuleIntersection(origin, direction, segmentStart, segmentEnd, radius, maxDistance = Infinity) {
  const ba = subtract(segmentEnd, segmentStart);
  const pa = subtract(origin, segmentStart);
  const baba = dot(ba, ba);
  const bard = dot(ba, direction);
  const baoa = dot(ba, pa);
  const r2 = radius * radius;

  const aTerm = baba - bard * bard;
  const bTerm = baba * dot(pa, direction) - baoa * bard;
  const cTerm = baba * (dot(pa, pa) - r2) - baoa * baoa;

  let distance = null;

  if (Math.abs(aTerm) > 1e-6) {
    let h = bTerm * bTerm - aTerm * cTerm;
    if (h >= 0) {
      h = Math.sqrt(h);
      const t = (-bTerm - h) / aTerm;
      const y = baoa + t * bard;
      if (t >= 0 && y > 0 && y < baba && t <= maxDistance) {
        distance = t;
      }
    }
  }

  if (distance == null) {
    const capA = raySphereIntersection(origin, direction, segmentStart, radius, maxDistance);
    const capB = raySphereIntersection(origin, direction, segmentEnd, radius, maxDistance);
    const t = Math.min(capA ?? Infinity, capB ?? Infinity);
    if (Number.isFinite(t)) {
      distance = t;
    }
  }

  return distance;
}
