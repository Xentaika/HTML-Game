import * as THREE from 'three';
import { WeaponDefinitions, WeaponId } from '../data/weapons.js';

const DEAD_ALPHA = 0.2;

export class RemotePlayer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.set(0, 0, 0);

    const body = this.createBody();
    this.body = body.root;
    this.upperBody = body.upperBody;
    this.aimPivot = body.aimPivot;
    this.head = body.head;
    this.legs = body.legs;
    this.leftArm = body.leftArm;
    this.rightArm = body.rightArm;
    this.leftForearm = body.leftForearm;
    this.rightForearm = body.rightForearm;
    this.group.add(this.body);

    this.weaponGroup = new THREE.Group();
    this.weaponGroup.position.set(0.42, 1.1, 0.08);
    this.aimPivot.add(this.weaponGroup);

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
    this.walkCycle = 0;
  }

  createBody() {
    const root = new THREE.Group();
    const clothMaterial = new THREE.MeshStandardMaterial({ color: 0x2e3c4a, roughness: 0.6, metalness: 0.1 });
    const vestMaterial = new THREE.MeshStandardMaterial({ color: 0x1b242d, roughness: 0.55, metalness: 0.2 });
    const limbMaterial = new THREE.MeshStandardMaterial({ color: 0x1d262f, roughness: 0.65, metalness: 0.05 });
    const gloveMaterial = new THREE.MeshStandardMaterial({ color: 0x141719, roughness: 0.4, metalness: 0.12 });
    const bootMaterial = new THREE.MeshStandardMaterial({ color: 0x171c1f, roughness: 0.5, metalness: 0.05 });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xcdbba3, roughness: 0.8, metalness: 0.05 });

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.3), clothMaterial);
    pelvis.position.y = 0.95;
    root.add(pelvis);

    const legs = new THREE.Group();
    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.85, 10), limbMaterial);
    leftLeg.position.set(-0.16, 0.42, 0);
    legs.add(leftLeg);
    const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.85, 10), limbMaterial);
    rightLeg.position.set(0.16, 0.42, 0);
    legs.add(rightLeg);

    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.34), bootMaterial);
    leftBoot.position.set(-0.16, -0.02, 0.08);
    legs.add(leftBoot);
    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.34), bootMaterial);
    rightBoot.position.set(0.16, -0.02, 0.08);
    legs.add(rightBoot);
    legs.position.y = 0.45;
    root.add(legs);

    const upperBody = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.7, 0.32), clothMaterial);
    torso.position.y = 1.4;
    upperBody.add(torso);

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.55, 0.34), vestMaterial);
    vest.position.y = 1.42;
    upperBody.add(vest);

    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.3), clothMaterial);
    shoulders.position.y = 1.62;
    upperBody.add(shoulders);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 10), skinMaterial);
    neck.position.y = 1.72;
    upperBody.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 20), skinMaterial);
    head.position.y = 1.92;
    upperBody.add(head);

    const headset = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.04, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.35, metalness: 0.3 }));
    headset.rotation.x = Math.PI / 2;
    headset.position.y = 1.92;
    upperBody.add(headset);

    const aimPivot = new THREE.Group();
    aimPivot.position.set(0, 1.45, 0);
    upperBody.add(aimPivot);

    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.6, 12), limbMaterial);
    leftArm.position.set(-0.34, 1.55, 0.02);
    leftArm.rotation.z = Math.PI / 10;
    upperBody.add(leftArm);

    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.55, 12), limbMaterial);
    leftForearm.position.set(-0.52, 1.3, 0.12);
    leftForearm.rotation.z = Math.PI / 6;
    upperBody.add(leftForearm);

    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.22), gloveMaterial);
    leftHand.position.set(-0.65, 1.12, 0.16);
    upperBody.add(leftHand);

    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.6, 12), limbMaterial);
    rightArm.position.set(0.34, 1.55, 0.02);
    rightArm.rotation.z = -Math.PI / 10;
    upperBody.add(rightArm);

    const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.55, 12), limbMaterial);
    rightForearm.position.set(0.5, 1.32, 0.18);
    rightForearm.rotation.z = -Math.PI / 7;
    upperBody.add(rightForearm);

    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.22), gloveMaterial);
    rightHand.position.set(0.66, 1.12, 0.18);
    upperBody.add(rightHand);

    root.add(upperBody);

    return {
      root,
      upperBody,
      aimPivot,
      head,
      legs,
      leftArm,
      rightArm,
      leftForearm,
      rightForearm
    };
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
      const pitchLean = THREE.MathUtils.clamp(this.targetPitch, -Math.PI / 3, Math.PI / 3);
      this.weaponGroup.rotation.x = -pitchLean * 0.35;
      this.weaponGroup.rotation.z = -pitchLean * 0.18;
      if (this.reloading) {
        this.reloadProgress = Math.min(1, this.reloadProgress + delta / 1.2);
        const swing = Math.sin(this.reloadProgress * Math.PI);
        this.weaponGroup.rotation.y = swing * 0.35;
        this.leftForearm.rotation.z = Math.PI / 6 + swing * 0.6;
        this.rightForearm.rotation.z = -Math.PI / 7 - swing * 0.45;
      } else {
        this.weaponGroup.rotation.y = THREE.MathUtils.lerp(this.weaponGroup.rotation.y, 0, delta * 10);
        this.reloadProgress = Math.max(0, this.reloadProgress - delta * 4);
        this.leftForearm.rotation.z = THREE.MathUtils.lerp(this.leftForearm.rotation.z, Math.PI / 6, delta * 6);
        this.rightForearm.rotation.z = THREE.MathUtils.lerp(this.rightForearm.rotation.z, -Math.PI / 7, delta * 6);
      }
    }

    const torsoMaterial = this.upperBody.children[0].material;
    torsoMaterial.opacity = this.isAlive ? 1 : DEAD_ALPHA;
    torsoMaterial.transparent = !this.isAlive;

    const headMaterial = this.head.material;
    headMaterial.opacity = this.isAlive ? 1 : DEAD_ALPHA;
    headMaterial.transparent = !this.isAlive;

    const baseMaterial = this.body.children[0].material;
    baseMaterial.opacity = this.isAlive ? 1 : DEAD_ALPHA;
    baseMaterial.transparent = !this.isAlive;

    const speed = this.velocity.length();
    const blend = THREE.MathUtils.clamp(speed / 6, 0, 1);
    this.walkCycle += delta * (2 + speed * 0.4);

    const stride = Math.sin(this.walkCycle) * 0.4 * blend;
    const counterStride = Math.cos(this.walkCycle) * 0.35 * blend;
    this.legs.children.forEach((leg, index) => {
      if (!(leg instanceof THREE.Mesh)) {
        return;
      }
      const dir = index % 2 === 0 ? 1 : -1;
      leg.rotation.x = dir === 1 ? stride : -stride * 0.9;
    });

    this.leftArm.rotation.x = -0.3 + counterStride * 0.25;
    this.rightArm.rotation.x = -0.25 - counterStride * 0.25;
    this.leftForearm.rotation.x = -0.1 + counterStride * 0.2;
    this.rightForearm.rotation.x = -0.05 - counterStride * 0.2;

    const headPitch = THREE.MathUtils.clamp(this.targetPitch, -Math.PI / 4, Math.PI / 4);
    this.aimPivot.rotation.x = headPitch * 0.6;
    this.head.rotation.x = headPitch * 0.85;
    this.upperBody.rotation.y = THREE.MathUtils.lerp(this.upperBody.rotation.y, Math.sin(this.targetPitch * 0.18) * 0.08, delta * 4);
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }

  buildWorldWeaponMesh(definition) {
    const group = new THREE.Group();
    const { length, thickness, color, accentColor, detailColor, gripColor } = definition.model;
    const baseMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5, metalness: 0.2 });
    const detailMaterial = new THREE.MeshStandardMaterial({ color: detailColor ?? accentColor, roughness: 0.45, metalness: 0.28 });
    const gripMaterial = new THREE.MeshStandardMaterial({ color: gripColor ?? color, roughness: 0.6, metalness: 0.18 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(thickness * 1.1, thickness * 0.45, length * 0.65), baseMaterial);
    base.position.set(0, 0.1, -length * 0.35);
    group.add(base);

    switch (definition.id) {
      case WeaponId.KNIFE: {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.12, thickness * 0.55, length * 0.7), accentMaterial);
        blade.position.set(0, 0.18, -length * 0.58);
        group.add(blade);
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.18, thickness * 0.18, length * 0.32, 10), gripMaterial);
        handle.rotation.z = Math.PI / 2;
        handle.position.set(0, -0.05, -length * 0.2);
        group.add(handle);
        break;
      }
      case WeaponId.GLOCK18:
      case WeaponId.DEAGLE: {
        const slide = new THREE.Mesh(new THREE.BoxGeometry(thickness * 1.05, thickness * 0.4, length * 0.55), baseMaterial);
        slide.position.set(0, 0.25, -length * 0.32);
        group.add(slide);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.8, thickness * 0.9, length * 0.45), gripMaterial);
        frame.position.set(0, -0.2, -length * 0.25);
        group.add(frame);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.1, thickness * 0.1, length * 0.2, 12), detailMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.2, -length * 0.7);
        group.add(barrel);
        break;
      }
      case WeaponId.MP9: {
        const mag = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.35, thickness * 1.5, thickness * 0.5), detailMaterial);
        mag.position.set(0, -0.8, -length * 0.15);
        group.add(mag);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.07, thickness * 0.07, length * 0.4, 12), detailMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.05, -length * 0.75);
        group.add(barrel);
        const foreGrip = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.16, thickness * 0.13, thickness * 0.65, 10), gripMaterial);
        foreGrip.rotation.x = Math.PI / 2.1;
        foreGrip.position.set(0, -0.55, -length * 0.45);
        group.add(foreGrip);
        break;
      }
      case WeaponId.AK47: {
        const stock = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.85, thickness * 0.45, length * 0.35), accentMaterial);
        stock.position.set(0.04, 0, length * 0.18);
        group.add(stock);
        const magazine = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.3, thickness * 0.26, length * 0.5, 14, 1, false, Math.PI * 0.1, Math.PI * 0.85), detailMaterial);
        magazine.rotation.x = Math.PI / 2;
        magazine.rotation.z = Math.PI / 9;
        magazine.position.set(0.08, -0.75, -length * 0.15);
        group.add(magazine);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.06, thickness * 0.06, length * 0.68, 12), detailMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0, -length * 0.78);
        group.add(barrel);
        break;
      }
      case WeaponId.M4A1: {
        const stock = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.7, thickness * 0.4, length * 0.3), accentMaterial);
        stock.position.set(0, 0.02, length * 0.16);
        group.add(stock);
        const magazine = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.32, thickness, length * 0.32), detailMaterial);
        magazine.position.set(0, -0.8, -length * 0.1);
        magazine.rotation.x = -0.2;
        group.add(magazine);
        const handguard = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.6, thickness * 0.45, length * 0.55), accentMaterial);
        handguard.position.set(0, 0, -length * 0.58);
        group.add(handguard);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.05, thickness * 0.05, length * 0.68, 12), detailMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.05, -length * 0.78);
        group.add(barrel);
        break;
      }
      case WeaponId.AWP: {
        const stock = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.7, thickness * 0.45, length * 0.36), accentMaterial);
        stock.position.set(0, -0.02, length * 0.2);
        group.add(stock);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.07, thickness * 0.07, length * 0.9, 16), detailMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.04, -length * 0.85);
        group.add(barrel);
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.2, thickness * 0.2, length * 0.5, 16), detailMaterial);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, 0.28, -length * 0.45);
        group.add(scope);
        break;
      }
      default:
        break;
    }

    return group;
  }
}
