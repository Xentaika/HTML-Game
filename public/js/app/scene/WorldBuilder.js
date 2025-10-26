import * as THREE from 'three';
import { ArenaLayout } from '/shared/arenaLayout.js';

export class WorldBuilder {
  static build(scene) {
    scene.background = new THREE.Color(0x1f242c);

    const ambient = new THREE.AmbientLight(0xb9c4d0, 0.35);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xf2f0e6, 0.8);
    sun.position.set(20, 40, 10);
    sun.castShadow = true;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x6b7078, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x3d434d, roughness: 0.7 });
    ArenaLayout.obstacles.forEach((obstacle) => {
      const geometry = new THREE.BoxGeometry(obstacle.size.x, obstacle.size.y, obstacle.size.z);
      const mesh = new THREE.Mesh(geometry, wallMaterial.clone());
      mesh.position.set(obstacle.position.x, obstacle.position.y, obstacle.position.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    });

    const buyZone = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7, 0.1, 24),
      new THREE.MeshBasicMaterial({ color: 0x2e7d32, transparent: true, opacity: 0.08 })
    );
    buyZone.position.set(0, 0.01, 0);
    scene.add(buyZone);
  }
}
