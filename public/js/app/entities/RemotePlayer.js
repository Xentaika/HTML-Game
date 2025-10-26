import * as THREE from 'three';
import { WeaponDefinitions } from '../data/weapons.js';

const DEAD_ALPHA = 0.2;

export class RemotePlayer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.set(0, 0, 0);
    this.walkCycle = 0;
    this.body = this.createBody();
    this.weaponGroup = new THREE.Group();
    this.weaponGroup.position.set(0.3, 1.25, -0.18);
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
    this.bodyMaterials = [];
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x2b313c, roughness: 0.75, metalness: 0.05 });
    const torsoMaterial = new THREE.MeshStandardMaterial({ color: 0x3c4b5b, roughness: 0.6, metalness: 0.12 });
    const gearMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2a32, roughness: 0.55, metalness: 0.2 });
    const armMaterial = new THREE.MeshStandardMaterial({ color: 0x262c35, roughness: 0.7, metalness: 0.08 });
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xc8ac8b, roughness: 0.8 });

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.32, 0.32), legMaterial);
    pelvis.position.y = 0.7;
    body.add(pelvis);
    this.bodyMaterials.push(pelvis.material);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.82, 0.4), torsoMaterial);
    torso.position.y = 1.2;
    body.add(torso);
    this.bodyMaterials.push(torso.material);

    const rig = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.36, 0.18), gearMaterial);
    rig.position.set(0, 1.36, 0.2);
    body.add(rig);
    this.bodyMaterials.push(rig.material);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 18), headMaterial);
    head.position.y = 1.82;
    body.add(head);
    this.bodyMaterials.push(head.material);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 18, 0, Math.PI * 2, 0, Math.PI / 1.5), gearMaterial);
    helmet.position.y = 1.85;
    body.add(helmet);
    this.bodyMaterials.push(helmet.material);

    const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.4, 6, 10), armMaterial);
    leftArm.rotation.z = Math.PI / 3;
    leftArm.position.set(-0.48, 1.35, 0.02);
    body.add(leftArm);
    this.bodyMaterials.push(leftArm.material);

    const rightArm = leftArm.clone();
    rightArm.rotation.z = -Math.PI / 3;
    rightArm.position.x = 0.48;
    body.add(rightArm);
    this.bodyMaterials.push(rightArm.material);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.82, 0.26), legMaterial);
    leftLeg.position.set(-0.18, 0.35, 0);
    body.add(leftLeg);
    this.bodyMaterials.push(leftLeg.material);

    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.18;
    body.add(rightLeg);
    this.bodyMaterials.push(rightLeg.material);

    this.limbs = { torso, head, leftArm, rightArm, leftLeg, rightLeg };
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
    const weapon = this.buildWorldWeaponMesh(definition);
    this.weaponGroup.add(weapon);
    this.weaponMesh = weapon;
    this.activeWeapon = weaponId;
    this.reloadProgress = 0;
  }

  buildWorldWeaponMesh(definition) {
    const group = new THREE.Group();
    const { length, thickness, color, accentColor } = definition.model;
    const baseMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5, metalness: 0.18 });

    if (definition.slot === 'melee') {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(thickness * 0.12, thickness * 0.12, length * 0.9),
        new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.7, roughness: 0.2 })
      );
      blade.position.set(0, 0.05, -length * 0.45);
      group.add(blade);

      const handle = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.15, thickness * 0.15, length * 0.35, 10), accentMaterial);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(0, -thickness * 0.2, -length * 0.2);
      group.add(handle);

      group.position.set(0.1, -0.12, -0.2);
      group.rotation.y = Math.PI / 2;
      return group;
    }

    const body = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.6, thickness * 0.4, length * 0.55), baseMaterial);
    body.position.set(0, 0, -length * 0.3);
    group.add(body);

    if (definition.slot === 'sidearm') {
      const slide = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.7, thickness * 0.28, length * 0.5), accentMaterial);
      slide.position.set(0, thickness * 0.22, -length * 0.35);
      group.add(slide);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.4, thickness * 0.8, thickness * 0.45), accentMaterial);
      grip.position.set(0, -thickness * 0.55, -length * 0.05);
      grip.rotation.x = Math.PI / 9;
      group.add(grip);

      group.position.set(0.18, 0.04, -0.12);
      group.rotation.y = Math.PI / 2;
      return group;
    }

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.07, thickness * 0.07, length * 0.55, 12), baseMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.04, -length * 0.85);
    group.add(barrel);

    const magazine = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.25, thickness * 0.8, thickness * 0.5), accentMaterial);
    magazine.position.set(0, -thickness * 0.65, -length * 0.2);
    magazine.rotation.x = Math.PI / 10;
    group.add(magazine);

    if (definition.slot === 'sniper') {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.16, thickness * 0.16, length * 0.45, 14), accentMaterial);
      scope.rotation.z = Math.PI / 2;
      scope.position.set(0, thickness * 0.36, -length * 0.2);
      group.add(scope);
    } else {
      const foregrip = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.35, thickness * 0.3, length * 0.3), accentMaterial);
      foregrip.position.set(0, -thickness * 0.18, -length * 0.6);
      group.add(foregrip);
    }

    group.position.set(0.12, -0.06, -0.12);
    group.rotation.y = Math.PI / 2;
    return group;
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

    const speed = this.velocity.length();
    this.walkCycle += delta * (5 + speed * 0.5);
    const walkSwing = Math.sin(this.walkCycle) * Math.min(speed * 0.18, 0.35);
    const armSwing = Math.sin(this.walkCycle + Math.PI) * Math.min(speed * 0.16, 0.3);

    if (this.limbs) {
      if (this.limbs.leftLeg) {
        this.limbs.leftLeg.rotation.x = walkSwing;
      }
      if (this.limbs.rightLeg) {
        this.limbs.rightLeg.rotation.x = -walkSwing;
      }
      if (this.limbs.leftArm) {
        this.limbs.leftArm.rotation.x = -armSwing - this.reloadProgress * 0.6;
      }
      if (this.limbs.rightArm) {
        this.limbs.rightArm.rotation.x = armSwing - this.reloadProgress * 0.4;
      }
      if (this.limbs.head) {
        const headPitch = THREE.MathUtils.clamp(this.targetPitch, -Math.PI / 6, Math.PI / 6);
        this.limbs.head.rotation.x = THREE.MathUtils.lerp(this.limbs.head.rotation.x, headPitch, delta * 8);
      }
    }

    if (this.weaponMesh) {
      const pitchLean = THREE.MathUtils.clamp(this.targetPitch, -Math.PI / 4, Math.PI / 4);
      this.weaponMesh.rotation.z = -pitchLean * 0.25;
      this.weaponMesh.rotation.x = -pitchLean * 0.2;
      if (this.reloading) {
        this.reloadProgress = Math.min(1, this.reloadProgress + delta / 1.2);
        this.weaponMesh.rotation.y = Math.sin(this.reloadProgress * Math.PI) * 0.35;
      } else {
        this.weaponMesh.rotation.y = THREE.MathUtils.lerp(this.weaponMesh.rotation.y, 0, delta * 10);
        this.reloadProgress = Math.max(0, this.reloadProgress - delta * 4);
      }
    }

    if (this.bodyMaterials) {
      this.bodyMaterials.forEach((material) => {
        if (!material) {
          return;
        }
        material.opacity = this.isAlive ? 1 : DEAD_ALPHA;
        material.transparent = !this.isAlive;
      });
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
}
