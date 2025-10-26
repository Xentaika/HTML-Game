import * as THREE from 'three';
import { WeaponDefinitions } from '../data/weapons.js';
import { buildWorldWeapon } from './weaponGeometry.js';

const DEAD_ALPHA = 0.2;

function createArm(side, materials) {
  const root = new THREE.Group();
  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.34, 8, 12), materials.torso);
  upper.position.y = -0.2;
  upper.rotation.z = side > 0 ? -0.12 : 0.12;
  root.add(upper);

  const forearm = new THREE.Group();
  forearm.position.y = -0.38;
  root.add(forearm);

  const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.3, 8, 10), materials.torsoAccent);
  lower.position.y = -0.18;
  forearm.add(lower);

  const handPivot = new THREE.Group();
  handPivot.position.set(0, -0.34, side > 0 ? 0.1 : 0.12);
  handPivot.rotation.set(-Math.PI / 2.4, 0, side > 0 ? 0.15 : -0.15);
  forearm.add(handPivot);

  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.2), materials.skin);
  hand.position.set(0, -0.08, 0);
  handPivot.add(hand);

  return { root, upper, forearm, lower, handPivot };
}

function createLeg(side, materials) {
  const root = new THREE.Group();
  root.position.set(side * 0.22, 0.95, 0);

  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.48, 10, 12), materials.pants);
  upper.position.y = -0.32;
  upper.rotation.x = 0.05;
  root.add(upper);

  const knee = new THREE.Group();
  knee.position.y = -0.58;
  root.add(knee);

  const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.36, 10, 12), materials.pants);
  lower.position.y = -0.2;
  knee.add(lower);

  const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.32), materials.gear);
  boot.position.set(0, -0.35, 0.1);
  knee.add(boot);

  return { root, upper, knee, lower, boot };
}

export class RemotePlayer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.materials = {
      torso: new THREE.MeshStandardMaterial({ color: 0x435564, metalness: 0.1, roughness: 0.82 }),
      torsoAccent: new THREE.MeshStandardMaterial({ color: 0x2f3d4a, metalness: 0.08, roughness: 0.84 }),
      pants: new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: 0.05, roughness: 0.88 }),
      gear: new THREE.MeshStandardMaterial({ color: 0x1a1f27, metalness: 0.25, roughness: 0.6 }),
      skin: new THREE.MeshStandardMaterial({ color: 0xd9c2a4, roughness: 0.92 })
    };
    this.bodyMaterials = [
      this.materials.torso,
      this.materials.torsoAccent,
      this.materials.pants,
      this.materials.gear,
      this.materials.skin
    ];

    this.body = this.createBody();
    this.group.add(this.body);

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
    this.walkPhase = 0;
    this.lastSnapshotTime = performance.now();
  }

  createBody() {
    const body = new THREE.Group();

    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.3, 0.34), this.materials.pants);
    hips.position.y = 0.95;
    body.add(hips);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.36), this.materials.gear);
    belt.position.set(0, 1.07, 0);
    body.add(belt);

    const spine = new THREE.Group();
    spine.position.y = 1.22;
    body.add(spine);
    this.spine = spine;

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.6, 0.36), this.materials.torso);
    chest.position.y = 0.18;
    spine.add(chest);

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.42, 0.3), this.materials.torsoAccent);
    vest.position.set(0, 0.22, 0.03);
    spine.add(vest);

    const shoulderBase = new THREE.Group();
    shoulderBase.position.y = 0.36;
    spine.add(shoulderBase);
    this.shoulderBase = shoulderBase;

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.26, 12), this.materials.skin);
    neck.position.y = 0.58;
    spine.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 18), this.materials.skin);
    head.position.y = 0.86;
    spine.add(head);
    this.head = head;

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.4), this.materials.gear);
    helmet.position.copy(head.position);
    helmet.rotation.x = -0.04;
    spine.add(helmet);

    this.leftArm = createArm(-1, this.materials);
    this.leftArm.root.position.set(-0.36, 0.32, 0);
    shoulderBase.add(this.leftArm.root);

    this.rightArm = createArm(1, this.materials);
    this.rightArm.root.position.set(0.36, 0.32, 0);
    shoulderBase.add(this.rightArm.root);

    this.leftLeg = createLeg(-1, this.materials);
    body.add(this.leftLeg.root);

    this.rightLeg = createLeg(1, this.materials);
    body.add(this.rightLeg.root);

    this.weaponGroup = new THREE.Group();
    this.weaponMount = this.rightArm.handPivot;
    this.weaponMount.add(this.weaponGroup);

    const sling = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 10, 24), this.materials.gear);
    sling.rotation.set(Math.PI / 2, 0, 0);
    sling.position.set(0, 1.38, 0.05);
    body.add(sling);

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
    const weapon = buildWorldWeapon(definition);
    weapon.position.set(0.05, -0.02, -definition.model.length * 0.32);
    weapon.rotation.set(0, Math.PI / 2, 0);
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

    const speed = this.velocity.length();
    this.walkPhase += speed * delta * 3.2;
    const walkAmount = Math.min(speed * 0.25, 1);

    const aimPitch = THREE.MathUtils.clamp(this.targetPitch, -Math.PI / 2, Math.PI / 2);
    this.spine.rotation.x = aimPitch * 0.2;
    this.head.rotation.x = aimPitch * 0.35;

    this.leftLeg.upper.rotation.x = Math.sin(this.walkPhase) * 0.7 * walkAmount;
    this.leftLeg.knee.rotation.x = Math.max(0, -Math.sin(this.walkPhase + Math.PI / 2) * 0.9 * walkAmount);
    this.rightLeg.upper.rotation.x = Math.sin(this.walkPhase + Math.PI) * 0.7 * walkAmount;
    this.rightLeg.knee.rotation.x = Math.max(0, -Math.sin(this.walkPhase + Math.PI * 1.5) * 0.9 * walkAmount);

    const armSwing = Math.sin(this.walkPhase + Math.PI) * 0.35 * walkAmount;
    this.leftArm.upper.rotation.x = -0.25 + armSwing;
    this.leftArm.forearm.rotation.x = -0.85 + aimPitch * 0.2;
    this.rightArm.upper.rotation.x = -0.35 - armSwing * 0.5 + aimPitch * 0.35;
    this.rightArm.forearm.rotation.x = -0.9 + aimPitch * 0.6;

    if (this.weaponMesh) {
      const targetMountX = -0.3 + aimPitch * 0.6;
      this.weaponMount.rotation.x = THREE.MathUtils.lerp(this.weaponMount.rotation.x, targetMountX, delta * 12);
      const reloadAmount = this.reloading ? Math.sin(Math.min(1, (this.reloadProgress += delta / 1.1)) * Math.PI) : 0;
      if (!this.reloading) {
        this.reloadProgress = Math.max(0, this.reloadProgress - delta * 3);
      }
      this.weaponMount.rotation.z = THREE.MathUtils.lerp(this.weaponMount.rotation.z, reloadAmount * 0.55, delta * 10);
      this.weaponMesh.rotation.y = Math.PI / 2;
      this.weaponMesh.rotation.x = aimPitch * -0.2;
    }

    this.bodyMaterials.forEach((material) => {
      material.opacity = this.isAlive ? 1 : DEAD_ALPHA;
      material.transparent = !this.isAlive;
    });
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
}
