import * as THREE from 'three';
import { WeaponId } from '../data/weapons.js';

function createMaterial(color, { metalness = 0.35, roughness = 0.48 } = {}) {
  const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
  material.flatShading = true;
  return material;
}

function addBox(target, { width, height, depth, color, position = [0, 0, 0], rotation = [0, 0, 0], materialOptions }) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geometry, createMaterial(color, materialOptions));
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  target.add(mesh);
  return mesh;
}

function addCylinder(target, { radiusTop, radiusBottom, height, radialSegments = 12, color, position = [0, 0, 0], rotation = [0, 0, 0], materialOptions }) {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
  const mesh = new THREE.Mesh(geometry, createMaterial(color, materialOptions));
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  target.add(mesh);
  return mesh;
}

function addHandle(target, { length, radius, color, position = [0, 0, 0], rotation = [0, 0, 0], materialOptions }) {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 10);
  const mesh = new THREE.Mesh(geometry, createMaterial(color, materialOptions));
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  target.add(mesh);
  return mesh;
}

function buildKnife(definition, options) {
  const { thickness, length, color, accentColor } = definition.model;
  const group = new THREE.Group();
  const gripLength = length * 0.4 * options.scale;
  addHandle(group, {
    length: gripLength,
    radius: thickness * 0.15 * options.scale,
    color: accentColor,
    position: [0, thickness * -0.1 * options.scale, length * -0.2 * options.scale],
    rotation: [0, 0, Math.PI / 2],
    materialOptions: { roughness: 0.6, metalness: 0.2 }
  });

  addBox(group, {
    width: thickness * 0.1 * options.scale,
    height: thickness * 0.4 * options.scale,
    depth: length * 0.65 * options.scale,
    color,
    position: [0, thickness * 0.2 * options.scale, -length * 0.3 * options.scale],
    materialOptions: { metalness: 0.7, roughness: 0.2 }
  });

  addBox(group, {
    width: thickness * 0.18 * options.scale,
    height: thickness * 0.05 * options.scale,
    depth: gripLength * 0.6,
    color: accentColor,
    position: [0, thickness * 0.0, -length * 0.02 * options.scale],
    materialOptions: { metalness: 0.25, roughness: 0.4 }
  });

  return group;
}

function buildPistol(definition, options, variant) {
  const { thickness, length, color, accentColor } = definition.model;
  const group = new THREE.Group();
  const scale = options.scale;

  addBox(group, {
    width: thickness * 0.6 * scale,
    height: thickness * 0.45 * scale,
    depth: length * 0.65 * scale,
    color,
    position: [0, thickness * 0.02 * scale, -length * 0.34 * scale]
  });

  addBox(group, {
    width: thickness * 0.58 * scale,
    height: thickness * 0.28 * scale,
    depth: length * 0.55 * scale,
    color: accentColor,
    position: [0, thickness * 0.28 * scale, -length * 0.32 * scale],
    materialOptions: { roughness: 0.35, metalness: 0.55 }
  });

  addBox(group, {
    width: thickness * 0.45 * scale,
    height: thickness * 0.9 * scale,
    depth: thickness * 0.5 * scale,
    color,
    position: [0, -thickness * 0.4 * scale, -length * 0.05 * scale],
    rotation: [0.35, 0, 0],
    materialOptions: { roughness: 0.55, metalness: 0.15 }
  });

  addBox(group, {
    width: thickness * 0.35 * scale,
    height: thickness * 0.22 * scale,
    depth: thickness * 0.4 * scale,
    color: accentColor,
    position: [0, thickness * 0.1 * scale, -length * 0.58 * scale]
  });

  if (variant === 'deagle') {
    addBox(group, {
      width: thickness * 0.6 * scale,
      height: thickness * 0.16 * scale,
      depth: length * 0.35 * scale,
      color,
      position: [0, thickness * 0.42 * scale, -length * 0.25 * scale]
    });

    addBox(group, {
      width: thickness * 0.18 * scale,
      height: thickness * 0.12 * scale,
      depth: length * 0.42 * scale,
      color: accentColor,
      position: [0, thickness * 0.52 * scale, -length * 0.28 * scale]
    });
  }

  addCylinder(group, {
    radiusTop: thickness * 0.09 * scale,
    radiusBottom: thickness * 0.09 * scale,
    height: thickness * 0.4 * scale,
    color: 0x191919,
    position: [0, thickness * 0.34 * scale, -length * 0.62 * scale],
    rotation: [Math.PI / 2, 0, 0],
    materialOptions: { metalness: 0.8, roughness: 0.2 }
  });

  return group;
}

function buildMP9(definition, options) {
  const { thickness, length, color, accentColor } = definition.model;
  const scale = options.scale;
  const group = new THREE.Group();

  addBox(group, {
    width: thickness * 0.7 * scale,
    height: thickness * 0.5 * scale,
    depth: length * 0.6 * scale,
    color,
    position: [0, thickness * 0.15 * scale, -length * 0.35 * scale]
  });

  addBox(group, {
    width: thickness * 0.35 * scale,
    height: thickness * 1.2 * scale,
    depth: thickness * 0.5 * scale,
    color: accentColor,
    position: [-thickness * 0.25 * scale, -thickness * 0.6 * scale, -length * 0.15 * scale],
    rotation: [0.22, 0, 0]
  });

  addBox(group, {
    width: thickness * 0.22 * scale,
    height: thickness * 1.1 * scale,
    depth: thickness * 0.4 * scale,
    color: 0x1e1e1e,
    position: [thickness * 0.22 * scale, -thickness * 0.55 * scale, -length * 0.1 * scale]
  });

  addBox(group, {
    width: thickness * 0.4 * scale,
    height: thickness * 0.3 * scale,
    depth: length * 0.22 * scale,
    color: accentColor,
    position: [0, thickness * 0.4 * scale, -length * 0.2 * scale]
  });

  addCylinder(group, {
    radiusTop: thickness * 0.12 * scale,
    radiusBottom: thickness * 0.08 * scale,
    height: length * 0.4 * scale,
    color: 0x151515,
    position: [0, thickness * 0.25 * scale, -length * 0.6 * scale],
    rotation: [Math.PI / 2, 0, 0]
  });

  return group;
}

function buildAK(definition, options) {
  const { thickness, length, color, accentColor } = definition.model;
  const scale = options.scale;
  const group = new THREE.Group();
  const wood = accentColor ?? 0x8f5c2a;

  addBox(group, {
    width: thickness * 0.6 * scale,
    height: thickness * 0.45 * scale,
    depth: length * 0.58 * scale,
    color,
    position: [0, thickness * 0.1 * scale, -length * 0.32 * scale]
  });

  addBox(group, {
    width: thickness * 0.65 * scale,
    height: thickness * 0.42 * scale,
    depth: length * 0.18 * scale,
    color: wood,
    position: [0, thickness * 0.05 * scale, length * 0.12 * scale]
  });

  addBox(group, {
    width: thickness * 0.52 * scale,
    height: thickness * 0.4 * scale,
    depth: length * 0.25 * scale,
    color: wood,
    position: [0, thickness * 0.05 * scale, -length * 0.1 * scale]
  });

  const magGroup = new THREE.Group();
  addBox(magGroup, {
    width: thickness * 0.32 * scale,
    height: thickness * 0.4 * scale,
    depth: length * 0.18 * scale,
    color: 0x1c1c1c,
    position: [0, -thickness * 0.25 * scale, length * 0.02 * scale]
  });
  addBox(magGroup, {
    width: thickness * 0.28 * scale,
    height: thickness * 0.3 * scale,
    depth: length * 0.18 * scale,
    color: 0x1e1e1e,
    position: [0, -thickness * 0.55 * scale, length * 0.05 * scale],
    rotation: [0.3, 0, 0]
  });
  magGroup.position.set(0, -thickness * 0.1 * scale, length * 0.05 * scale);
  group.add(magGroup);

  addCylinder(group, {
    radiusTop: thickness * 0.08 * scale,
    radiusBottom: thickness * 0.08 * scale,
    height: length * 0.55 * scale,
    color: 0x111111,
    position: [0, thickness * 0.22 * scale, -length * 0.62 * scale],
    rotation: [Math.PI / 2, 0, 0]
  });

  addBox(group, {
    width: thickness * 0.25 * scale,
    height: thickness * 0.2 * scale,
    depth: length * 0.18 * scale,
    color,
    position: [0, thickness * 0.33 * scale, -length * 0.58 * scale]
  });

  return group;
}

function buildM4(definition, options) {
  const { thickness, length, color, accentColor } = definition.model;
  const scale = options.scale;
  const group = new THREE.Group();

  addBox(group, {
    width: thickness * 0.62 * scale,
    height: thickness * 0.46 * scale,
    depth: length * 0.58 * scale,
    color,
    position: [0, thickness * 0.12 * scale, -length * 0.32 * scale]
  });

  addBox(group, {
    width: thickness * 0.5 * scale,
    height: thickness * 0.28 * scale,
    depth: length * 0.25 * scale,
    color: accentColor,
    position: [0, thickness * 0.38 * scale, -length * 0.28 * scale]
  });

  addBox(group, {
    width: thickness * 0.35 * scale,
    height: thickness * 1.05 * scale,
    depth: thickness * 0.45 * scale,
    color: 0x222831,
    position: [0, -thickness * 0.55 * scale, -length * 0.02 * scale]
  });

  addCylinder(group, {
    radiusTop: thickness * 0.08 * scale,
    radiusBottom: thickness * 0.08 * scale,
    height: length * 0.6 * scale,
    color: 0x111111,
    position: [0, thickness * 0.24 * scale, -length * 0.64 * scale],
    rotation: [Math.PI / 2, 0, 0]
  });

  addCylinder(group, {
    radiusTop: thickness * 0.05 * scale,
    radiusBottom: thickness * 0.05 * scale,
    height: length * 0.2 * scale,
    color: accentColor,
    position: [0, thickness * 0.24 * scale, -length * 0.86 * scale],
    rotation: [Math.PI / 2, 0, 0],
    materialOptions: { roughness: 0.35, metalness: 0.75 }
  });

  addBox(group, {
    width: thickness * 0.22 * scale,
    height: thickness * 0.28 * scale,
    depth: length * 0.18 * scale,
    color,
    position: [0, thickness * 0.45 * scale, -length * 0.58 * scale]
  });

  addBox(group, {
    width: thickness * 0.18 * scale,
    height: thickness * 0.2 * scale,
    depth: length * 0.32 * scale,
    color: accentColor,
    position: [0, thickness * 0.45 * scale, -length * 0.4 * scale]
  });

  return group;
}

function buildAWP(definition, options) {
  const { thickness, length, color, accentColor } = definition.model;
  const scale = options.scale;
  const group = new THREE.Group();

  addBox(group, {
    width: thickness * 0.6 * scale,
    height: thickness * 0.4 * scale,
    depth: length * 0.7 * scale,
    color,
    position: [0, thickness * 0.12 * scale, -length * 0.4 * scale]
  });

  addBox(group, {
    width: thickness * 0.5 * scale,
    height: thickness * 0.25 * scale,
    depth: length * 0.2 * scale,
    color: color,
    position: [0, thickness * 0.15 * scale, length * 0.02 * scale]
  });

  addBox(group, {
    width: thickness * 0.36 * scale,
    height: thickness * 1.1 * scale,
    depth: thickness * 0.4 * scale,
    color: 0x202020,
    position: [0, -thickness * 0.55 * scale, -length * 0.05 * scale]
  });

  addCylinder(group, {
    radiusTop: thickness * 0.09 * scale,
    radiusBottom: thickness * 0.09 * scale,
    height: length * 0.9 * scale,
    color: 0x101010,
    position: [0, thickness * 0.25 * scale, -length * 0.75 * scale],
    rotation: [Math.PI / 2, 0, 0]
  });

  const scope = addCylinder(group, {
    radiusTop: thickness * 0.22 * scale,
    radiusBottom: thickness * 0.2 * scale,
    height: length * 0.5 * scale,
    radialSegments: 16,
    color: accentColor,
    position: [0, thickness * 0.45 * scale, -length * 0.3 * scale],
    rotation: [Math.PI / 2, 0, 0],
    materialOptions: { metalness: 0.45, roughness: 0.3 }
  });
  scope.scale.set(1, 1, 0.9);

  addBox(group, {
    width: thickness * 0.12 * scale,
    height: thickness * 0.18 * scale,
    depth: length * 0.3 * scale,
    color: accentColor,
    position: [0, thickness * 0.45 * scale, -length * 0.1 * scale]
  });

  const bipod = new THREE.Group();
  addBox(bipod, {
    width: thickness * 0.05 * scale,
    height: length * 0.18 * scale,
    depth: thickness * 0.05 * scale,
    color: 0x1e1e1e,
    position: [-thickness * 0.12 * scale, -length * 0.09 * scale, 0],
    rotation: [0.6, 0, 0]
  });
  addBox(bipod, {
    width: thickness * 0.05 * scale,
    height: length * 0.18 * scale,
    depth: thickness * 0.05 * scale,
    color: 0x1e1e1e,
    position: [thickness * 0.12 * scale, -length * 0.09 * scale, 0],
    rotation: [0.6, 0, 0]
  });
  bipod.position.set(0, -thickness * 0.05 * scale, -length * 0.58 * scale);
  group.add(bipod);

  return group;
}

function buildWeapon(definition, options) {
  switch (definition.id) {
    case WeaponId.KNIFE:
      return buildKnife(definition, options);
    case WeaponId.GLOCK18:
      return buildPistol(definition, options, 'glock');
    case WeaponId.DEAGLE:
      return buildPistol(definition, options, 'deagle');
    case WeaponId.MP9:
      return buildMP9(definition, options);
    case WeaponId.AK47:
      return buildAK(definition, options);
    case WeaponId.M4A1:
      return buildM4(definition, options);
    case WeaponId.AWP:
      return buildAWP(definition, options);
    default: {
      const group = new THREE.Group();
      addBox(group, {
        width: definition.model.thickness * 0.6 * options.scale,
        height: definition.model.thickness * 0.4 * options.scale,
        depth: definition.model.length * 0.5 * options.scale,
        color: definition.model.color,
        position: [0, 0, -definition.model.length * 0.25 * options.scale]
      });
      return group;
    }
  }
}

export function buildFirstPersonWeapon(definition) {
  const group = buildWeapon(definition, { scale: 1 });
  return group;
}

export function buildWorldWeapon(definition) {
  const group = buildWeapon(definition, { scale: 0.82 });
  group.scale.setScalar(0.88);
  return group;
}
