import * as THREE from 'three';
import { WeaponDefinitions } from '../data/weapons.js';

const BASE_OFFSET = new THREE.Vector3(0.32, -0.38, -0.62);

export class WeaponViewModel {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.position.copy(BASE_OFFSET);
    this.group.rotation.order = 'YXZ';
    this.camera.add(this.group);

    this.hands = this.buildHands();
    this.group.add(this.hands);
    this.handRig = this.createHandRig(this.hands);
    this.handCycle = 0;

    this.currentWeaponId = null;
    this.weaponGroup = new THREE.Group();
    this.group.add(this.weaponGroup);

    this.muzzleFlash = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.16, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff4b0, transparent: true, opacity: 0 })
    );
    this.muzzleFlash.rotation.x = Math.PI / 2;
    this.weaponGroup.add(this.muzzleFlash);

    this.recoilOffset = new THREE.Vector3();
    this.recoilRotation = new THREE.Euler(0, 0, 0, 'YXZ');
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
    const { mesh, muzzleOffset } = this.buildWeaponMesh(definition);
    this.weaponGroup.add(mesh);
    if (muzzleOffset) {
      this.muzzleFlash.position.copy(muzzleOffset);
    } else {
      this.muzzleFlash.position.set(0, 0.08, -definition.model.length * 0.52);
    }
    this.reloadTime = definition.reloadTime;
    this.reloading = false;
  }

  buildWeaponMesh(definition) {
    const group = new THREE.Group();
    const { length, thickness, color, accentColor } = definition.model;
    const baseMaterial = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.35 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.32, roughness: 0.45 });
    let muzzleOffset = null;

    const addIronSights = (height = thickness * 0.35) => {
      const rearSight = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.12, thickness * 0.12, thickness * 0.12), accentMaterial);
      rearSight.position.set(0, height, length * 0.05);
      group.add(rearSight);
      const frontSight = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.08, thickness * 0.18, thickness * 0.06), accentMaterial);
      frontSight.position.set(0, height, -length * 0.88);
      group.add(frontSight);
    };

    if (definition.slot === 'melee') {
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(thickness * 0.15, thickness * 0.15, length * 0.4, 12),
        accentMaterial
      );
      handle.rotation.z = Math.PI / 2;
      handle.position.set(0, -thickness * 0.25, -length * 0.2);
      group.add(handle);

      const blade = new THREE.Mesh(
        new THREE.CylinderGeometry(thickness * 0.05, thickness * 0.05, length * 0.75, 6),
        new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.8, roughness: 0.15 })
      );
      blade.rotation.z = Math.PI / 2;
      blade.position.set(0, 0.05, -length * 0.45);
      group.add(blade);

      return { mesh: group, muzzleOffset };
    }

    if (definition.slot === 'sidearm') {
      const slide = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.9, thickness * 0.36, length * 0.65), baseMaterial);
      slide.position.set(0, thickness * 0.25, -length * 0.35);
      group.add(slide);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.8, thickness * 0.52, length * 0.55), accentMaterial);
      frame.position.set(0, -thickness * 0.05, -length * 0.38);
      group.add(frame);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.5, thickness * 1.1, thickness * 0.5), accentMaterial);
      grip.position.set(0, -thickness * 0.7, -length * 0.1);
      grip.rotation.x = Math.PI / 9;
      group.add(grip);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.09, thickness * 0.09, length * 0.55, 12), baseMaterial);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, thickness * 0.12, -length * 0.82);
      group.add(barrel);
      muzzleOffset = new THREE.Vector3(0, thickness * 0.12, -length * 0.9);

      addIronSights(thickness * 0.4);
      return { mesh: group, muzzleOffset };
    }

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.7, thickness * 0.5, length * 0.5), baseMaterial);
    receiver.position.set(0, 0, -length * 0.32);
    group.add(receiver);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.08, thickness * 0.08, length * 0.6, 14), baseMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.06, -length * 0.85);
    group.add(barrel);
    muzzleOffset = new THREE.Vector3(0, 0.06, -length * 0.95);

    if (definition.slot === 'smg') {
      const foregrip = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.12, thickness * 0.12, thickness * 0.7, 12), accentMaterial);
      foregrip.rotation.x = Math.PI / 2;
      foregrip.position.set(0, -thickness * 0.75, -length * 0.5);
      group.add(foregrip);

      const mag = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.28, thickness * 0.9, thickness * 0.6), accentMaterial);
      mag.position.set(0, -thickness * 0.9, -length * 0.15);
      mag.rotation.x = Math.PI / 10;
      group.add(mag);

      const stock = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.5, thickness * 0.4, length * 0.3), accentMaterial);
      stock.position.set(0, -thickness * 0.05, length * 0.18);
      group.add(stock);

      addIronSights();
      return { mesh: group, muzzleOffset };
    }

    if (definition.slot === 'sniper') {
      const stock = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.6, thickness * 0.45, length * 0.36), accentMaterial);
      stock.position.set(0, -thickness * 0.1, length * 0.25);
      group.add(stock);

      const cheekRest = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.5, thickness * 0.18, length * 0.18), accentMaterial);
      cheekRest.position.set(0, thickness * 0.2, length * 0.12);
      group.add(cheekRest);

      const scope = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.18, thickness * 0.18, length * 0.55, 16), accentMaterial);
      scope.rotation.z = Math.PI / 2;
      scope.position.set(0, thickness * 0.42, -length * 0.25);
      group.add(scope);

      const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(thickness * 0.18, 16), new THREE.MeshStandardMaterial({ color: 0x1a1f24, metalness: 0.1, roughness: 0.8 }));
      scopeLens.rotation.y = Math.PI / 2;
      scopeLens.position.set(0, thickness * 0.42, -length * 0.51);
      group.add(scopeLens);

      const bipod = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.03, thickness * 0.03, length * 0.4, 8), accentMaterial);
      bipod.rotation.z = Math.PI / 4;
      bipod.position.set(0.12, -thickness * 0.35, -length * 0.55);
      group.add(bipod);
      const bipod2 = bipod.clone();
      bipod2.rotation.z = -Math.PI / 4;
      bipod2.position.x = -0.12;
      group.add(bipod2);

      addIronSights(thickness * 0.5);
      return { mesh: group, muzzleOffset };
    }

    const handGuard = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.6, thickness * 0.4, length * 0.42), accentMaterial);
    handGuard.position.set(0, -thickness * 0.05, -length * 0.65);
    group.add(handGuard);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.55, thickness * 0.4, length * 0.32), accentMaterial);
    stock.position.set(-0.02, -thickness * 0.1, length * 0.18);
    group.add(stock);

    if (definition.id === 'ak47') {
      const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.06, thickness * 0.06, length * 0.42, 10), accentMaterial);
      gasTube.rotation.x = Math.PI / 2;
      gasTube.position.set(0, thickness * 0.22, -length * 0.62);
      group.add(gasTube);

      const mag = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.18, thickness * 0.18, length * 0.55, 14, 1, false, Math.PI * 0.15, Math.PI * 0.7),
        new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.2, roughness: 0.45 }));
      mag.rotation.z = Math.PI / 2;
      mag.rotation.y = Math.PI / 6;
      mag.position.set(0, -thickness * 0.9, -length * 0.18);
      group.add(mag);
    } else {
      const mag = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.26, thickness * 0.9, thickness * 0.6), accentMaterial);
      mag.position.set(0, -thickness * 0.85, -length * 0.2);
      mag.rotation.x = Math.PI / 12;
      group.add(mag);

      const rail = new THREE.Mesh(new THREE.BoxGeometry(thickness * 0.48, thickness * 0.12, length * 0.4), new THREE.MeshStandardMaterial({ color: 0x1d222c, metalness: 0.4, roughness: 0.3 }));
      rail.position.set(0, thickness * 0.32, -length * 0.52);
      group.add(rail);
    }

    addIronSights();
    return { mesh: group, muzzleOffset };
  }

  updateAmmo(state) {
    this.currentAmmoState = state;
  }

  kick() {
    const definition = WeaponDefinitions[this.currentWeaponId];
    const scale = (definition?.recoilKick ?? 1) * 0.75;
    this.recoilOffset.z -= 0.08 * scale;
    this.recoilRotation.x -= 0.05 * scale;
    this.recoilRotation.y += (Math.random() - 0.5) * 0.015 * scale;
    this.recoilRotation.z += (Math.random() - 0.5) * 0.012 * scale;
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

    const speed = state.velocity.length();
    const bob = Math.sin(performance.now() * 0.005 * (1 + speed * 0.25)) * Math.min(speed * 0.02, 0.05);
    this.handCycle += delta * (6 + speed * 0.4);
    const swayStrength = Math.min(speed * 0.18, 1);
    const swayOffset = Math.sin(this.handCycle) * 0.015 * swayStrength;
    const swayLift = Math.sin(this.handCycle * 2) * 0.01 * swayStrength;

    if (this.reloading) {
      this.reloadProgress = Math.min(1, this.reloadProgress + delta / Math.max(this.reloadTime, 0.1));
    } else {
      this.reloadProgress = Math.max(0, this.reloadProgress - delta * 2);
    }

    const reloadTilt = Math.sin(this.reloadProgress * Math.PI) * 0.6;

    this.group.position.copy(BASE_OFFSET);
    this.group.position.x += swayOffset * 0.5;
    this.group.position.y += bob + swayLift;
    this.group.position.add(this.recoilOffset);

    this.group.rotation.x = -state.pitch * 0.18 + this.recoilRotation.x + reloadTilt * 0.22;
    this.group.rotation.y = this.recoilRotation.y + swayOffset * 0.8;
    this.group.rotation.z = Math.sin(performance.now() * 0.004) * 0.02 + reloadTilt * 0.28 + this.recoilRotation.z;

    this.updateHands({ bob, swayOffset, swayLift, reloadTilt, pitch: state.pitch, speed });

    if (this.muzzleFlash.material.opacity > 0) {
      this.muzzleFlash.material.opacity = Math.max(0, this.muzzleFlash.material.opacity - delta * 6);
      const scale = 1 + (1 - this.muzzleFlash.material.opacity) * 1.5;
      this.muzzleFlash.scale.set(scale, scale, scale);
    }
  }

  buildHands() {
    const group = new THREE.Group();
    const sleeveMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2d3a, roughness: 0.6, metalness: 0.05 });
    const gloveMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.4, metalness: 0.1 });

    const leftSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.34, 6, 10), sleeveMaterial);
    leftSleeve.rotation.z = Math.PI / 2.6;
    leftSleeve.position.set(-0.32, -0.08, -0.42);
    group.add(leftSleeve);

    const leftGlove = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.18, 6, 10), gloveMaterial);
    leftGlove.rotation.z = Math.PI / 2.1;
    leftGlove.position.set(-0.42, -0.16, -0.62);
    group.add(leftGlove);

    const rightSleeve = leftSleeve.clone();
    rightSleeve.position.set(0.26, -0.05, -0.28);
    rightSleeve.rotation.z = -Math.PI / 2.8;
    group.add(rightSleeve);

    const rightGlove = leftGlove.clone();
    rightGlove.position.set(0.16, -0.14, -0.48);
    rightGlove.rotation.z = -Math.PI / 2.6;
    group.add(rightGlove);

    return group;
  }

  createHandRig(group) {
    const rig = {
      leftSleeve: group.children[0] ?? null,
      leftGlove: group.children[1] ?? null,
      rightSleeve: group.children[2] ?? null,
      rightGlove: group.children[3] ?? null
    };
    return rig;
  }

  updateHands({ bob, swayOffset, swayLift, reloadTilt, pitch, speed }) {
    if (!this.hands) {
      return;
    }
    const idleOffset = Math.min(speed * 0.015, 0.06);
    this.hands.position.x = swayOffset * 1.2;
    this.hands.position.y = -0.05 + bob * 0.6 + swayLift * 0.5;
    this.hands.position.z = -0.05 + this.recoilOffset.z * 0.4;
    this.hands.rotation.z = swayOffset * 3;
    this.hands.rotation.x = reloadTilt * 0.4 - pitch * 0.05;

    if (this.handRig.leftSleeve) {
      this.handRig.leftSleeve.rotation.x = -0.2 + idleOffset * 2 - reloadTilt * 0.4;
    }
    if (this.handRig.rightSleeve) {
      this.handRig.rightSleeve.rotation.x = -0.1 + idleOffset * 1.5 - reloadTilt * 0.45;
    }
  }
}
