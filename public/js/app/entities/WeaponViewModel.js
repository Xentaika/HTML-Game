import * as THREE from 'three';
import { WeaponDefinitions, WeaponId } from '../data/weapons.js';

const BASE_OFFSET = new THREE.Vector3(0.32, -0.38, -0.62);

export class WeaponViewModel {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.position.copy(BASE_OFFSET);
    this.group.rotation.order = 'YXZ';
    this.camera.add(this.group);

    this.currentWeaponId = null;
    this.weaponGroup = new THREE.Group();
    this.group.add(this.weaponGroup);

    this.handRig = this.createHands();
    this.group.add(this.handRig.root);

    this.muzzleFlash = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.16, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff4b0, transparent: true, opacity: 0 })
    );
    this.muzzleFlash.rotation.x = Math.PI / 2;
    this.weaponGroup.add(this.muzzleFlash);

    this.recoilOffset = new THREE.Vector3();
    this.recoilRotation = new THREE.Euler(0, 0, 0, 'YXZ');
    this.handOffset = new THREE.Vector3();
    this.handRotation = new THREE.Euler(0, 0, 0, 'YXZ');
    this.sway = new THREE.Vector2();
    this.reloadTime = 0;
    this.reloadProgress = 0;
    this.reloading = false;
  }

  equip(weaponId) {
    if (!weaponId || this.currentWeaponId === weaponId) {
      return;
    }
    const definition = WeaponDefinitions[weaponId];
    if (!definition) {
      return;
    }
    this.currentWeaponId = weaponId;
    this.weaponGroup.clear();
    this.weaponGroup.add(this.muzzleFlash);
    const weaponMesh = this.buildWeaponMesh(definition);
    this.weaponGroup.add(weaponMesh);
    const muzzleDistance = definition.model.muzzleOffset ?? definition.model.length * 0.48;
    this.muzzleFlash.position.set(0, 0.08, -muzzleDistance);
    this.reloadTime = definition.reloadTime;
    this.reloading = false;
  }

  buildWeaponMesh(definition) {
    const group = new THREE.Group();
    const { length, thickness, color, accentColor, detailColor, gripColor } = definition.model;
    const baseMaterial = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.45 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.25, roughness: 0.5 });
    const detailMaterial = new THREE.MeshStandardMaterial({ color: detailColor ?? accentColor, metalness: 0.4, roughness: 0.35 });
    const gripMaterial = new THREE.MeshStandardMaterial({ color: gripColor ?? color, metalness: 0.15, roughness: 0.6 });

    switch (definition.id) {
      case WeaponId.KNIFE: {
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.18, thickness * 0.18, length * 0.4, 10), gripMaterial);
        handle.rotation.z = Math.PI / 2;
        handle.position.set(0, -thickness * 0.05, -length * 0.2);
        group.add(handle);

        const guard = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.4, thickness * 0.1, thickness * 0.05), detailMaterial);
        guard.position.set(0, thickness * 0.05, -length * 0.38);
        group.add(guard);

        const blade = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.08, thickness * 0.5, length * 0.65), accentMaterial);
        blade.position.set(0, thickness * 0.12, -length * 0.7);
        group.add(blade);
        break;
      }
      case WeaponId.GLOCK18:
      case WeaponId.DEAGLE: {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.9, thickness * 0.6, length * 0.55), gripMaterial);
        frame.position.set(0, -thickness * 0.45, -length * 0.35);
        group.add(frame);

        const slide = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.95, thickness * 0.45, length * 0.62), baseMaterial);
        slide.position.set(0, thickness * 0.15, -length * 0.35);
        group.add(slide);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.08, thickness * 0.08, length * 0.2, 12), detailMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, thickness * 0.2, -length * 0.75);
        group.add(barrel);

        const grip = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.5, thickness, thickness * 0.55), gripMaterial);
        grip.position.set(0, -thickness * 0.6, -length * 0.25);
        grip.rotation.x = -0.35;
        group.add(grip);

        const sights = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.15, thickness * 0.1, thickness * 0.6), detailMaterial);
        sights.position.set(0, thickness * 0.45, -length * 0.35);
        group.add(sights);
        break;
      }
      case WeaponId.MP9: {
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.9, thickness * 0.6, length * 0.65), baseMaterial);
        receiver.position.set(0, 0, -length * 0.32);
        group.add(receiver);

        const stock = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.4, thickness * 0.5, length * 0.3), accentMaterial);
        stock.position.set(0, -thickness * 0.05, length * 0.18);
        stock.rotation.x = 0.12;
        group.add(stock);

        const magazine = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.3, thickness * 1.4, thickness * 0.45), detailMaterial);
        magazine.position.set(0, -thickness * 0.95, -length * 0.18);
        group.add(magazine);

        const foreGrip = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.16, thickness * 0.12, thickness * 0.7, 10), gripMaterial);
        foreGrip.rotation.x = Math.PI / 2.1;
        foreGrip.position.set(0, -thickness * 0.65, -length * 0.45);
        group.add(foreGrip);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.07, thickness * 0.07, length * 0.45, 12), detailMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, thickness * 0.1, -length * 0.75);
        group.add(barrel);
        break;
      }
      case WeaponId.AK47: {
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(thickness * 1.05, thickness * 0.55, length * 0.55), baseMaterial);
        receiver.position.set(0, -thickness * 0.05, -length * 0.32);
        group.add(receiver);

        const stock = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.9, thickness * 0.55, length * 0.35), accentMaterial);
        stock.position.set(0.02, -thickness * 0.1, length * 0.25);
        stock.rotation.x = 0.08;
        group.add(stock);

        const grip = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.35, thickness * 0.7, thickness * 0.45), gripMaterial);
        grip.position.set(-0.05, -thickness * 0.75, -length * 0.12);
        grip.rotation.x = -0.35;
        group.add(grip);

        const magazine = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.26, thickness * 0.22, length * 0.48, 14, 1, false, Math.PI * 0.1, Math.PI * 0.8), detailMaterial);
        magazine.rotation.x = Math.PI / 2;
        magazine.rotation.z = Math.PI / 10;
        magazine.position.set(0.05, -thickness * 0.8, -length * 0.08);
        group.add(magazine);

        const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.07, thickness * 0.07, length * 0.62, 12), detailMaterial);
        gasTube.rotation.x = Math.PI / 2;
        gasTube.position.set(0, thickness * 0.2, -length * 0.62);
        group.add(gasTube);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.05, thickness * 0.05, length * 0.7, 12), detailMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, thickness * 0.02, -length * 0.78);
        group.add(barrel);

        const frontSight = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.18, thickness * 0.22, thickness * 0.15), detailMaterial);
        frontSight.position.set(0, thickness * 0.15, -length * 0.95);
        group.add(frontSight);
        break;
      }
      case WeaponId.M4A1: {
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.95, thickness * 0.6, length * 0.55), baseMaterial);
        receiver.position.set(0, -thickness * 0.05, -length * 0.32);
        group.add(receiver);

        const stock = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.7, thickness * 0.45, length * 0.32), accentMaterial);
        stock.position.set(0, -thickness * 0.05, length * 0.2);
        group.add(stock);

        const bufferTube = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.08, thickness * 0.08, length * 0.22, 12), detailMaterial);
        bufferTube.rotation.x = Math.PI / 2;
        bufferTube.position.set(0, thickness * 0.02, length * 0.26);
        group.add(bufferTube);

        const grip = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.32, thickness * 0.7, thickness * 0.4), gripMaterial);
        grip.position.set(-0.03, -thickness * 0.75, -length * 0.12);
        grip.rotation.x = -0.35;
        group.add(grip);

        const magazine = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.32, thickness, length * 0.35), detailMaterial);
        magazine.position.set(0, -thickness * 0.9, -length * 0.1);
        magazine.rotation.x = -0.2;
        group.add(magazine);

        const handGuard = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.6, thickness * 0.5, length * 0.55), accentMaterial);
        handGuard.position.set(0, -thickness * 0.05, -length * 0.65);
        group.add(handGuard);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.05, thickness * 0.05, length * 0.7, 12), detailMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, thickness * 0.05, -length * 0.78);
        group.add(barrel);

        const frontSight = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.15, thickness * 0.22, thickness * 0.16), detailMaterial);
        frontSight.position.set(0, thickness * 0.2, -length * 0.94);
        group.add(frontSight);

        const carryHandle = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.55, thickness * 0.25, length * 0.22), detailMaterial);
        carryHandle.position.set(0, thickness * 0.35, -length * 0.32);
        group.add(carryHandle);
        break;
      }
      case WeaponId.AWP: {
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(thickness, thickness * 0.5, length * 0.7), baseMaterial);
        chassis.position.set(0, -thickness * 0.05, -length * 0.4);
        group.add(chassis);

        const stock = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.7, thickness * 0.5, length * 0.35), accentMaterial);
        stock.position.set(0, -thickness * 0.05, length * 0.25);
        group.add(stock);

        const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.32, thickness * 0.7, thickness * 0.4), gripMaterial);
        pistolGrip.position.set(-0.05, -thickness * 0.8, -length * 0.08);
        pistolGrip.rotation.x = -0.32;
        group.add(pistolGrip);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.06, thickness * 0.06, length * 0.9, 16), detailMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, thickness * 0.05, -length * 0.85);
        group.add(barrel);

        const scope = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.18, thickness * 0.18, length * 0.5, 16), detailMaterial);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, thickness * 0.28, -length * 0.45);
        group.add(scope);

        const scopeMount = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.4, thickness * 0.18, length * 0.3), detailMaterial);
        scopeMount.position.set(0, thickness * 0.15, -length * 0.45);
        group.add(scopeMount);

        const bipod = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.08, thickness * 0.02, length * 0.24), detailMaterial);
        bipod.rotation.x = 0.4;
        bipod.position.set(0, -thickness * 0.4, -length * 0.7);
        group.add(bipod);
        break;
      }
      default: {
        const body = new THREE.Mesh(new THREE.BoxGeometry(thickness, thickness * 0.6, length * 0.7), baseMaterial);
        body.position.set(0, -thickness * 0.05, -length * 0.4);
        group.add(body);
        break;
      }
    }

    return group;
  }

  updateAmmo(state) {
    this.currentAmmoState = state;
  }

  kick() {
    this.recoilOffset.z -= 0.12;
    this.recoilRotation.x -= 0.08;
    this.handOffset.z -= 0.05;
    this.handRotation.x -= 0.04;
  }

  pulseMuzzle({ hit = false, headshot = false } = {}) {
    this.muzzleFlash.material.opacity = 0.8;
    this.muzzleFlash.material.color.set(headshot ? 0xff8080 : hit ? 0xc2ff8c : 0xfff4b0);
    this.muzzleFlash.scale.set(1, 1, 1);
  }

  setReloading(isReloading) {
    if (isReloading) {
      this.reloading = true;
      this.reloadProgress = 0;
    } else {
      this.reloading = false;
    }
  }

  update(delta, state) {
    const decay = Math.exp(-delta * 10);
    this.recoilOffset.multiplyScalar(decay);
    this.recoilRotation.x *= decay;
    this.recoilRotation.y *= decay;
    this.recoilRotation.z *= decay;
    this.handOffset.multiplyScalar(decay);
    this.handRotation.x *= decay;
    this.handRotation.y *= decay;
    this.handRotation.z *= decay;

    const speed = state.velocity.length();
    this.sway.x = THREE.MathUtils.lerp(this.sway.x, state.yaw, delta * 5);

    const bob = Math.sin(performance.now() * 0.005 * (1 + speed * 0.2)) * Math.min(speed * 0.02, 0.05);

    if (this.reloading) {
      this.reloadProgress = Math.min(1, this.reloadProgress + delta / Math.max(this.reloadTime, 0.1));
    } else {
      this.reloadProgress = Math.max(0, this.reloadProgress - delta * 2);
    }

    const reloadTilt = Math.sin(this.reloadProgress * Math.PI) * 0.6;

    this.group.position.copy(BASE_OFFSET);
    this.group.position.y += bob;
    this.group.position.add(this.recoilOffset);

    this.group.rotation.x = -state.pitch * 0.18 + this.recoilRotation.x + reloadTilt * 0.2;
    this.group.rotation.y = this.recoilRotation.y;
    this.group.rotation.z = Math.sin(performance.now() * 0.004) * 0.02 + reloadTilt * 0.25;

    if (this.muzzleFlash.material.opacity > 0) {
      this.muzzleFlash.material.opacity = Math.max(0, this.muzzleFlash.material.opacity - delta * 6);
      const scale = 1 + (1 - this.muzzleFlash.material.opacity) * 1.5;
      this.muzzleFlash.scale.set(scale, scale, scale);
    }

    this.handRig.root.position.set(-0.02, -0.05 + bob * 1.5, -0.08);
    this.handRig.root.position.add(this.handOffset);
    this.handRig.root.rotation.set(-0.25 + this.handRotation.x + reloadTilt * 0.4, 0.1 + this.handRotation.y, -0.15 + this.handRotation.z);
    this.handRig.leftArm.rotation.x = -0.3 + reloadTilt * 0.6;
    this.handRig.rightArm.rotation.x = -0.15 + reloadTilt * 0.4;
    this.handRig.leftHand.rotation.y = 0.3;
    this.handRig.rightHand.rotation.y = -0.2;

    if (this.reloading) {
      const reloadSwing = Math.sin(this.reloadProgress * Math.PI);
      this.weaponGroup.rotation.x = reloadSwing * 0.4;
      this.weaponGroup.rotation.y = reloadSwing * 0.3;
      this.handRig.root.rotation.x += reloadSwing * 0.5;
      this.handRig.leftHand.rotation.x = reloadSwing * 0.9;
      this.handRig.rightHand.rotation.x = reloadSwing * 0.4;
    } else {
      this.weaponGroup.rotation.x = THREE.MathUtils.lerp(this.weaponGroup.rotation.x, 0, delta * 8);
      this.weaponGroup.rotation.y = THREE.MathUtils.lerp(this.weaponGroup.rotation.y, 0, delta * 8);
      this.handRig.leftHand.rotation.x = THREE.MathUtils.lerp(this.handRig.leftHand.rotation.x, 0, delta * 6);
      this.handRig.rightHand.rotation.x = THREE.MathUtils.lerp(this.handRig.rightHand.rotation.x, 0, delta * 6);
    }
  }

  createHands() {
    const root = new THREE.Group();
    const sleeveMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2c3a, roughness: 0.65, metalness: 0.05 });
    const gloveMaterial = new THREE.MeshStandardMaterial({ color: 0x121314, roughness: 0.4, metalness: 0.1 });

    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.55, 8), sleeveMaterial);
    leftArm.rotation.z = Math.PI / 2.4;
    leftArm.position.set(-0.26, -0.04, -0.35);
    root.add(leftArm);

    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.2), gloveMaterial);
    leftHand.position.set(-0.38, -0.14, -0.34);
    root.add(leftHand);

    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.58, 8), sleeveMaterial);
    rightArm.rotation.z = Math.PI / 2.8;
    rightArm.position.set(0.18, -0.05, -0.22);
    root.add(rightArm);

    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.22), gloveMaterial);
    rightHand.position.set(0.3, -0.16, -0.26);
    root.add(rightHand);

    return { root, leftArm, rightArm, leftHand, rightHand };
  }
}
