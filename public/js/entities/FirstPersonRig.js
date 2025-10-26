import * as THREE from 'three';

function buildViewModel(template) {
  const group = new THREE.Group();
  const armMaterial = new THREE.MeshStandardMaterial({ color: 0x4c4b45, roughness: 0.6 });

  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.6, 12), armMaterial);
  leftArm.position.set(-0.25, -0.1, -0.2);
  leftArm.rotation.z = Math.PI / 5;
  group.add(leftArm);

  const rightArm = leftArm.clone();
  rightArm.position.x = 0.35;
  rightArm.rotation.z = -Math.PI / 5;
  group.add(rightArm);

  const handMaterial = new THREE.MeshStandardMaterial({ color: 0x8c7f66, roughness: 0.5 });
  const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.2), handMaterial);
  leftHand.position.set(-0.35, -0.35, -0.4);
  group.add(leftHand);
  const rightHand = leftHand.clone();
  rightHand.position.x = 0.25;
  group.add(rightHand);

  const weapon = new THREE.Group();
  const templateCategory = template?.category || 'Melee';
  if (!template || template.slot === 'melee') {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.3), new THREE.MeshStandardMaterial({ color: 0x1b1b1b }));
    handle.position.set(0, -0.3, -0.3);
    weapon.add(handle);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.5), new THREE.MeshStandardMaterial({ color: 0xcfd2cf }));
    blade.position.set(0, -0.3, -0.65);
    weapon.add(blade);
  } else {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.18, 1.2),
      new THREE.MeshStandardMaterial({ color: templateCategory === 'Sniper' ? 0x1f2023 : 0x272829, metalness: 0.5, roughness: 0.35 })
    );
    body.position.set(0.1, -0.26, -0.6);
    weapon.add(body);

    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.26, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x353535, roughness: 0.5 })
    );
    grip.position.set(-0.05, -0.5, -0.35);
    grip.rotation.x = THREE.MathUtils.degToRad(18);
    weapon.add(grip);

    if (templateCategory !== 'Pistols') {
      const stock = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.18, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x2d2e2f, roughness: 0.4 })
      );
      stock.position.set(0.32, -0.28, -0.2);
      weapon.add(stock);
    }

    if (templateCategory === 'Sniper') {
      const scope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.5, 14),
        new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.2, metalness: 0.6 })
      );
      scope.rotation.z = Math.PI / 2;
      scope.position.set(0.05, -0.14, -0.55);
      weapon.add(scope);
    }
  }

  weapon.position.set(0.1, -0.1, -0.2);
  group.add(weapon);
  return { group, weapon };
}

export class FirstPersonRig {
  constructor(camera, weaponTemplates = {}) {
    this.camera = camera;
    this.weaponTemplates = weaponTemplates;
    this.root = new THREE.Group();
    this.root.position.set(0.2, -0.2, -0.35);
    this.camera.add(this.root);
    this.currentWeaponId = null;
    this.weaponGroup = null;
    this.weaponHolder = new THREE.Group();
    this.root.add(this.weaponHolder);
    this.recoilOffset = 0;
    this.reloadTarget = 0;
    this.reloadProgress = 0;
  }

  setWeaponTemplates(templates) {
    this.weaponTemplates = templates || {};
  }

  setWeapon(weaponId) {
    if (this.currentWeaponId === weaponId) {
      return;
    }
    if (this.weaponGroup) {
      this.weaponHolder.remove(this.weaponGroup);
    }
    const template = weaponId ? this.weaponTemplates[weaponId] : null;
    const { group, weapon } = buildViewModel(template);
    this.weaponGroup = group;
    this.weaponMesh = weapon;
    this.weaponHolder.add(group);
    this.currentWeaponId = weaponId;
  }

  triggerShot() {
    this.recoilOffset = 0.08;
  }

  setReloading(reloading) {
    this.reloadTarget = reloading ? 1 : 0;
  }

  update(delta, aimPitch = 0, movementFactor = 0) {
    this.recoilOffset = THREE.MathUtils.damp(this.recoilOffset, 0, 12, delta);
    this.reloadProgress = THREE.MathUtils.damp(this.reloadProgress, this.reloadTarget, 6, delta);

    const targetX = THREE.MathUtils.degToRad(aimPitch * 0.4 - this.reloadProgress * 22);
    const targetZ = THREE.MathUtils.degToRad(this.reloadProgress * 8 + Math.sin(performance.now() * 0.006) * 1.5 * movementFactor);
    const targetY = this.recoilOffset - Math.abs(Math.sin(performance.now() * 0.004)) * 0.02 * movementFactor;

    this.weaponHolder.rotation.x = THREE.MathUtils.lerp(this.weaponHolder.rotation.x, targetX, 0.25);
    this.weaponHolder.rotation.z = THREE.MathUtils.lerp(this.weaponHolder.rotation.z, targetZ, 0.18);
    this.weaponHolder.position.y = THREE.MathUtils.lerp(this.weaponHolder.position.y, -0.1 + targetY, 0.25);
  }
}
