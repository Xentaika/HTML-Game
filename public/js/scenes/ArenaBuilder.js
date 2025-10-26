import * as THREE from 'three';

export class ArenaBuilder {
  static build(scene, arenaConfig = {}) {
    const floorSize = arenaConfig.floorSize ?? 160;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(floorSize, floorSize),
      new THREE.MeshStandardMaterial({ color: 0x4b4a3f, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const lines = new THREE.GridHelper(floorSize, floorSize / 4, 0x2e2e28, 0x2e2e28);
    lines.position.y = 0.01;
    scene.add(lines);

    const walls = new THREE.Group();
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2b26, roughness: 0.8 });
    const wallHeight = 8;
    const wallThickness = 1.5;
    const half = floorSize / 2;

    const wallGeomLong = new THREE.BoxGeometry(floorSize, wallHeight, wallThickness);
    const wallGeomShort = new THREE.BoxGeometry(wallThickness, wallHeight, floorSize);

    const northWall = new THREE.Mesh(wallGeomLong, wallMaterial);
    northWall.position.set(0, wallHeight / 2, -half);
    walls.add(northWall);

    const southWall = new THREE.Mesh(wallGeomLong, wallMaterial);
    southWall.position.set(0, wallHeight / 2, half);
    walls.add(southWall);

    const westWall = new THREE.Mesh(wallGeomShort, wallMaterial);
    westWall.position.set(-half, wallHeight / 2, 0);
    walls.add(westWall);

    const eastWall = new THREE.Mesh(wallGeomShort, wallMaterial);
    eastWall.position.set(half, wallHeight / 2, 0);
    walls.add(eastWall);

    scene.add(walls);

    const coverMaterial = new THREE.MeshStandardMaterial({ color: 0x57574d, roughness: 0.7, metalness: 0.15 });
    const colliders = arenaConfig.colliders || [];
    const cover = arenaConfig.cover || [];

    [...colliders, ...cover].forEach((item) => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const mesh = new THREE.Mesh(geometry, coverMaterial.clone());
      mesh.position.set(item.position[0], item.position[1], item.position[2]);
      mesh.scale.set(item.scale[0], item.scale[1], item.scale[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    });

    const buyZones = arenaConfig.buyZones || [];
    buyZones.forEach((zone) => {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(zone.radius, zone.radius, 0.2, 40, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xd6a756, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(zone.center[0], 0.1, zone.center[2]);
      scene.add(ring);
    });

    const ambient = new THREE.HemisphereLight(0x7e8576, 0x1b1c18, 0.55);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xf4d79a, 0.6);
    keyLight.position.set(40, 60, -20);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xb0b4b0, 0.3);
    fillLight.position.set(-25, 30, 40);
    scene.add(fillLight);
  }
}
