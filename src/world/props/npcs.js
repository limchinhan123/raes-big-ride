import * as THREE from 'three';
import { mulberry32 } from '../../core/prng.js';

// Ambient life: pedestrians, dog walkers, oncoming cyclists, bus-stop
// queues, playground kids, an airliner overhead. Rae loves people —
// the world should never feel empty.

const SKIN_TONES = [0xf2c9a4, 0xe8b088, 0xc98f62, 0xa8714a];
const SHIRTS = [0xe8657a, 0x5a8fd0, 0x6fae6a, 0xf2b035, 0x9a7ec8, 0xe88bb0, 0x4aa8a0, 0xd8d8d2];
const BOTTOMS = [0x3a4a62, 0x6b6353, 0x8a4a3c, 0x4a4a50, 0xd8cfc0];

export function buildPerson(seed, { child = false, elderly = false } = {}) {
  const rand = mulberry32(seed);
  const skin = new THREE.MeshStandardMaterial({ color: SKIN_TONES[Math.floor(rand() * SKIN_TONES.length)], roughness: 0.65 });
  const shirt = new THREE.MeshStandardMaterial({ color: (elderly ? [0x8a94a6, 0xb0a08a, 0x9a8f7a, 0x7a8a80] : SHIRTS)[Math.floor(rand() * (elderly ? 4 : SHIRTS.length))], roughness: 0.85 });
  const bottom = new THREE.MeshStandardMaterial({ color: BOTTOMS[Math.floor(rand() * BOTTOMS.length)], roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: elderly ? (rand() < 0.5 ? 0xe2e0dc : 0xcbc6bd) : (rand() < 0.85 ? 0x2c2622 : 0x6b6353), roughness: elderly ? 0.92 : 0.75 });

  const sc = child ? 0.62 : 0.92 + rand() * 0.14;
  const g = new THREE.Group();

  const hips = new THREE.Group();
  hips.position.y = 0.52 * sc;
  g.add(hips);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.13 * sc, 0.3 * sc, 6, 10), shirt);
  torso.position.y = 0.26 * sc;
  torso.castShadow = true;
  hips.add(torso);
  const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.115 * sc, 0.06 * sc, 4, 10), bottom);
  pelvis.castShadow = true;
  hips.add(pelvis);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105 * sc, 12, 10), skin);
  head.position.y = 0.55 * sc;
  head.castShadow = true;
  hips.add(head);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.108 * sc, 12, 10), hair);
  hairCap.position.set(0, 0.57 * sc, -0.015 * sc);
  hairCap.scale.set(1, 0.92, 0.95);
  hips.add(hairCap);
  if (!elderly && rand() < 0.3) { // ponytail or bun
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.05 * sc, 8, 6), hair);
    bun.position.set(0, 0.6 * sc, -0.1 * sc);
    hips.add(bun);
  }
  if (elderly) { // stooped upper body, head carried forward
    torso.rotation.x = 0.3;
    torso.position.set(0, 0.235 * sc, 0.05 * sc);
    head.position.set(0, 0.5 * sc, 0.1 * sc);
    hairCap.position.set(0, 0.52 * sc, 0.085 * sc);
  }

  const limbs = {};
  for (const [key, side] of [['L', -1], ['R', 1]]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.06 * sc, -0.02 * sc, 0);
    hips.add(leg);
    const legMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.05 * sc, 0.36 * sc, 4, 8), bottom);
    legMesh.position.y = -0.24 * sc;
    legMesh.castShadow = true;
    leg.add(legMesh);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.075 * sc, 0.05 * sc, 0.15 * sc), bottom);
    foot.position.set(0, -0.45 * sc, 0.045 * sc);
    foot.castShadow = true;
    leg.add(foot);
    const arm = new THREE.Group();
    arm.position.set(side * 0.15 * sc, 0.42 * sc, 0);
    hips.add(arm);
    const armMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.038 * sc, 0.3 * sc, 4, 8), shirt);
    armMesh.position.y = -0.16 * sc;
    armMesh.castShadow = true;
    arm.add(armMesh);
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.035 * sc, 0.14 * sc, 4, 8), skin);
    forearm.position.y = -0.33 * sc;
    arm.add(forearm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045 * sc, 8, 6), skin);
    hand.position.y = -0.44 * sc;
    arm.add(hand);
    limbs[`leg${key}`] = leg;
    limbs[`arm${key}`] = arm;
  }

  const walk = (t, speed = 1) => {
    const w = Math.sin(t * 5.2 * speed);
    limbs.legL.rotation.x = w * 0.5;
    limbs.legR.rotation.x = -w * 0.5;
    limbs.armL.rotation.x = -w * 0.4;
    limbs.armR.rotation.x = w * 0.4;
    hips.position.y = 0.52 * sc + Math.abs(Math.cos(t * 5.2 * speed)) * 0.02;
  };
  const idle = (t) => {
    limbs.legL.rotation.x = 0; limbs.legR.rotation.x = 0;
    limbs.armL.rotation.x = Math.sin(t * 0.8 + seed) * 0.06;
    limbs.armR.rotation.x = -Math.sin(t * 0.8 + seed) * 0.06;
    hips.position.y = 0.52 * sc + Math.sin(t * 1.4 + seed) * 0.008;
  };
  const jump = (t) => {
    const b = Math.abs(Math.sin(t * 3.4 + seed));
    hips.position.y = 0.52 * sc + b * 0.16 * sc;
    limbs.armL.rotation.z = 0.8 + b * 1.6;
    limbs.armR.rotation.z = -0.8 - b * 1.6;
  };

  return { group: g, walk, idle, jump, height: sc };
}

export function buildDog(seed = 1) {
  const rand = mulberry32(seed);
  const fur = new THREE.MeshStandardMaterial({ color: [0xc9a06a, 0x8a6a4e, 0xe8e0d0, 0x4a4038][Math.floor(rand() * 4)], roughness: 0.9 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.24, 4, 10), fur);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.22;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), fur);
  head.position.set(0, 0.32, 0.2);
  g.add(head);
  const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.05, 4, 6), fur);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.29, 0.28);
  g.add(snout);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), fur);
    ear.position.set(s * 0.055, 0.38, 0.17);
    ear.scale.set(0.7, 1.2, 0.5);
    g.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.14, 4, 6), fur);
  tail.position.set(0, 0.3, -0.16);
  tail.rotation.x = -0.7;
  g.add(tail);
  const legs = [];
  for (const [lx, lz] of [[-0.055, 0.09], [0.055, 0.09], [-0.055, -0.09], [0.055, -0.09]]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.14, 4, 6), fur);
    leg.position.set(lx, 0.1, lz);
    g.add(leg);
    legs.push(leg);
  }
  const walk = (t) => {
    legs.forEach((leg, i) => { leg.rotation.x = Math.sin(t * 6 + (i % 2) * Math.PI) * 0.5; });
    tail.rotation.z = Math.sin(t * 7) * 0.35;
  };
  return { group: g, walk };
}

// airliner crossing high above, SIA-ish gold tail
export function buildPlane() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.4 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a83c, roughness: 0.5 });
  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 10, 6, 12), white);
  fuselage.rotation.x = Math.PI / 2;
  g.add(fuselage);
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.18, 1.9), white);
    wing.position.set(s * 4.2, -0.2, -0.4);
    wing.rotation.z = s * 0.1;
    wing.rotation.y = s * 0.35;
    g.add(wing);
    const stab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1), white);
    stab.position.set(s * 1.5, 0.3, -5.2);
    stab.rotation.y = s * 0.3;
    g.add(stab);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.3, 1.7), gold);
  tail.position.set(0, 1.2, -5.1);
  tail.rotation.x = 0.35;
  g.add(tail);
  return g;
}
