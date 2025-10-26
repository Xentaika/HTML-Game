import * as THREE from 'three';

export class ArenaBuilder {
  static build(scene) {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({ color: 0x5f666d, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const boundaryMaterial = new THREE.MeshStandardMaterial({ color: 0x394046, roughness: 0.8 });
    const wallHeight = 6;
    const wallThickness = 1.5;
    const walls = [
      new THREE.BoxGeometry(160, wallHeight, wallThickness),
      new THREE.BoxGeometry(160, wallHeight, wallThickness),
      new THREE.BoxGeometry(wallThickness, wallHeight, 160),
      new THREE.BoxGeometry(wallThickness, wallHeight, 160)
    ];

    const wallPositions = [
      new THREE.Vector3(0, wallHeight / 2, -80),
      new THREE.Vector3(0, wallHeight / 2, 80),
      new THREE.Vector3(-80, wallHeight / 2, 0),
      new THREE.Vector3(80, wallHeight / 2, 0)
    ];

    walls.forEach((geometry, index) => {
      const wall = new THREE.Mesh(geometry, boundaryMaterial);
      wall.position.copy(wallPositions[index]);
      wall.receiveShadow = true;
      wall.castShadow = true;
      scene.add(wall);
    });

    const crateMaterial = new THREE.MeshStandardMaterial({ color: 0x4d5359, roughness: 0.6, metalness: 0.1 });
    const crates = [
      { position: [0, 1.5, -12], scale: [5, 3, 5] },
      { position: [-10, 1.2, 6], scale: [6, 2.4, 4] },
      { position: [14, 3, 10], scale: [5, 6, 5] },
      { position: [-18, 2, -8], scale: [7, 4, 7] },
      { position: [10, 1.5, -24], scale: [6, 3, 6] }
    ];

    crates.forEach(({ position, scale }) => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const mesh = new THREE.Mesh(geometry, crateMaterial);
      mesh.position.set(...position);
      mesh.scale.set(...scale);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    });

    const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xf2f5f7, emissive: 0xb9c6d0, emissiveIntensity: 0.5 });
    const lampGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12);
    for (let i = 0; i < 6; i++) {
      const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
      lamp.position.set(-20 + i * 8, 5.8, -30 + (i % 2 === 0 ? 0 : 12));
      scene.add(lamp);
      const light = new THREE.PointLight(0xcfd5db, 0.35, 36, 2);
      light.position.copy(lamp.position);
      light.position.y += 0.6;
      scene.add(light);
    }

    const buyZoneMaterial = new THREE.MeshBasicMaterial({ color: 0x4aa564, transparent: true, opacity: 0.16 });
    const buyZoneGeometry = new THREE.CircleGeometry(5.5, 32);
    const buyZones = [
      { position: new THREE.Vector3(0, 0.02, 0) },
      { position: new THREE.Vector3(10, 0.02, -5) }
    ];
    buyZones.forEach(({ position }) => {
      const mesh = new THREE.Mesh(buyZoneGeometry, buyZoneMaterial);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(position);
      scene.add(mesh);
    });

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(320, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x1a1f24, side: THREE.BackSide })
    );
    scene.add(sky);
  }
}
