import * as THREE from 'three';

export class ArenaBuilder {
  static build(scene) {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x0a0f23, metalness: 0.2, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(120, 60, 0x0aefff, 0x083766);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    const obstacles = [
      { position: [0, 2, -12], scale: [4, 4, 4] },
      { position: [-10, 1.2, 6], scale: [6, 2.4, 4] },
      { position: [12, 3, 10], scale: [4, 6, 4] },
      { position: [-14, 2.5, -8], scale: [5, 5, 5] }
    ];

    obstacles.forEach(({ position, scale }) => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.6, 0.5),
        metalness: 0.4,
        roughness: 0.5
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.scale.set(...scale);
      scene.add(mesh);
      mesh.updateMatrixWorld(true);
    });

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(200, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x030712, side: THREE.BackSide })
    );
    scene.add(sky);

    const neonRings = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(30 + i * 4, 0.3, 16, 100),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x0df5ff : 0xff3bf5 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 8 + i * 1.2;
      neonRings.add(ring);
    }
    scene.add(neonRings);
  }
}
