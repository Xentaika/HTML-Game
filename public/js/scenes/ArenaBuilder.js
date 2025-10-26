import * as THREE from 'three';

export class ArenaBuilder {
  static build(scene) {
    scene.fog = new THREE.FogExp2(0x9aa7b1, 0.015);

    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x9b9f9c,
      roughness: 0.85,
      metalness: 0.05
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = false;
    scene.add(floor);

    const boundaryMaterial = new THREE.MeshStandardMaterial({ color: 0x6a7277, roughness: 0.8 });
    const wallHeight = 6;
    const wallThickness = 1.2;
    const wallLength = 160;

    const walls = [
      { position: [0, wallHeight / 2, -wallLength / 2], rotationY: 0 },
      { position: [0, wallHeight / 2, wallLength / 2], rotationY: 0 },
      { position: [-wallLength / 2, wallHeight / 2, 0], rotationY: Math.PI / 2 },
      { position: [wallLength / 2, wallHeight / 2, 0], rotationY: Math.PI / 2 }
    ];

    walls.forEach((wall) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(wallLength, wallHeight, wallThickness), boundaryMaterial);
      mesh.position.set(...wall.position);
      mesh.rotation.y = wall.rotationY;
      scene.add(mesh);
    });

    const coverMaterial = new THREE.MeshStandardMaterial({ color: 0x505a63, roughness: 0.7, metalness: 0.1 });
    const crates = new THREE.MeshStandardMaterial({ color: 0x4f4032, roughness: 0.9 });

    const coverPieces = [
      { position: [0, 1.6, -12], scale: [6, 3.2, 3] },
      { position: [-10, 1.4, 6], scale: [5, 2.8, 3] },
      { position: [12, 2.2, 10], scale: [4, 4.4, 3] },
      { position: [-14, 2, -8], scale: [4, 3.4, 4] }
    ];

    coverPieces.forEach(({ position, scale }) => {
      const block = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), coverMaterial);
      block.position.set(position[0], position[1], position[2]);
      block.scale.set(scale[0], scale[1], scale[2]);
      scene.add(block);
    });

    const cratesData = [
      { position: [-4, 0.8, -6], scale: [1.6, 1.6, 1.6] },
      { position: [6, 0.6, -3], scale: [1.2, 1.2, 1.2] },
      { position: [-6, 0.9, 5], scale: [1.4, 1.4, 1.4] },
      { position: [4, 0.8, 8], scale: [1.6, 1.4, 1.6] }
    ];

    cratesData.forEach(({ position, scale }) => {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), crates);
      crate.position.set(position[0], position[1], position[2]);
      crate.scale.set(scale[0], scale[1], scale[2]);
      scene.add(crate);
    });

    const lightPostsMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2f35, metalness: 0.3, roughness: 0.6 });
    for (let i = -2; i <= 2; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 6, 12), lightPostsMaterial);
      post.position.set(i * 12, 3, -20);
      scene.add(post);
    }
  }
}
