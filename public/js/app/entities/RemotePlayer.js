import * as THREE from 'three';
import { WeaponDefinitions } from '../data/weapons.js';

const DEAD_ALPHA = 0.2;

export class RemotePlayer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.set(0, 0, 0);
    this.body = this.createBody();
    this.weaponGroup = new THREE.Group();
    this.body.add(this.weaponGroup);
    this.group.add(this.body);
    this.scene.add(this.group);

    this.targetPosition = new THREE.Vector3();
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.velocity = new THREE.Vector3();
    this.isAlive = true;
    this.health = 100;
    this.activeWeapon = null;
    this.weaponMesh = null;
    this.reloadProgress = 0;
    this.reloading = false;
    this.lastSnapshotTime = performance.now();
  }

  createBody() {
    const body = new THREE.Group();

    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.2, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x5a6c7c, metalness: 0.05, roughness: 0.7 })
    );
    torso.position.y = 1.0;
    body.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xd2c9b5, roughness: 0.8 })
    );
    head.position.y = 1.8;
    body.add(head);

    return body;
  }

  ensureWeaponMesh(weaponId) {
    if (this.activeWeapon === weaponId) {
      return;
    }
    const definition = WeaponDefinitions[weaponId];
    if (!definition) {
      return;
    }
    this.weaponGroup.clear();
    const material = new THREE.MeshStandardMaterial({ color: definition.model.color, roughness: 0.6, metalness: 0.2 });
    const geometry = new THREE.BoxGeometry(definition.model.thickness * 1.2, definition.model.thickness * 0.5, definition.model.length);
    const weapon = new THREE.Mesh(geometry, material);
    weapon.position.set(0.4, 1.1, -definition.model.length * 0.4);
    weapon.rotation.y = Math.PI / 2;
    this.weaponGroup.add(weapon);
    this.weaponMesh = weapon;
    this.activeWeapon = weaponId;
  }

  applySnapshot(snapshot) {
    this.targetPosition.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
    this.velocity.set(snapshot.velocity.x, snapshot.velocity.y, snapshot.velocity.z);
    this.targetYaw = snapshot.yaw;
    this.targetPitch = snapshot.pitch;
    this.isAlive = snapshot.isAlive;
    this.health = snapshot.health;
    this.ensureWeaponMesh(snapshot.activeWeapon);

    const activeWeaponState = snapshot.weapons.find((weapon) => weapon.id === snapshot.activeWeapon);
    if (activeWeaponState) {
      this.reloading = activeWeaponState.reloading;
      if (this.reloading) {
        this.reloadProgress = 0;
      }
    }
    this.lastSnapshotTime = performance.now();
  }

  update(delta) {
    this.group.position.lerp(this.targetPosition, 1 - Math.exp(-delta * 12));
    const yaw = THREE.MathUtils.lerpAngle(this.group.rotation.y, this.targetYaw, 1 - Math.exp(-delta * 12));
    this.group.rotation.y = yaw;

    if (this.weaponMesh) {
      const pitchLean = THREE.MathUtils.clamp(this.targetPitch, -Math.PI / 4, Math.PI / 4);
      this.weaponMesh.rotation.z = -pitchLean * 0.3;
      this.weaponMesh.rotation.x = -pitchLean * 0.25;
      if (this.reloading) {
        this.reloadProgress = Math.min(1, this.reloadProgress + delta / 1.2);
        this.weaponMesh.rotation.y = Math.sin(this.reloadProgress * Math.PI) * 0.3;
      } else {
        this.weaponMesh.rotation.y = THREE.MathUtils.lerp(this.weaponMesh.rotation.y, 0, delta * 10);
        this.reloadProgress = Math.max(0, this.reloadProgress - delta * 4);
      }
    }

    const material = this.body.children[0].material;
    material.opacity = this.isAlive ? 1 : DEAD_ALPHA;
    material.transparent = !this.isAlive;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
}
