import * as THREE from 'three';
import { paintMaterial, MAT, tubeAlong, buildWheel } from './common.js';

// Rae's real bicycle: white B'Twin 500 14" — step-through frame, blue chain
// guard, yellow front basket, bell, training wheels. +Z = forward.

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildBike({ frameColor = 0xf4f4f0 } = {}) {
  const g = new THREE.Group();
  const paint = paintMaterial(frameColor);

  const WHEEL_R = 0.175;
  const BASE = { front: 0.3, rear: -0.31 }; // z positions of axles (kid-short wheelbase)
  const AXLE_Y = WHEEL_R;

  // wheels
  const front = buildWheel({ r: WHEEL_R });
  front.position.set(0, AXLE_Y, BASE.front);
  const rear = buildWheel({ r: WHEEL_R });
  rear.position.set(0, AXLE_Y, BASE.rear);
  g.add(front, rear);

  // training wheels on brackets
  const training = [];
  for (const side of [-1, 1]) {
    const tw = buildWheel({ r: 0.062, tireR: 0.014, spokes: 0 });
    tw.position.set(side * 0.17, 0.062, BASE.rear + 0.02);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 16), new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.6 }));
    disc.rotation.z = Math.PI / 2;
    tw.add(disc);
    g.add(tw);
    const bracket = tubeAlong([V(side * 0.02, AXLE_Y, BASE.rear), V(side * 0.16, 0.1, BASE.rear + 0.02)], 0.007, MAT.dark(), 6, 6);
    g.add(bracket);
    training.push(tw);
  }

  // step-through main tube: head tube down to bottom bracket, swoop up to seat
  const headTop = V(0, 0.52, BASE.front - 0.035);
  const headBot = V(0, 0.36, BASE.front + 0.01);
  const bb = V(0, 0.155, -0.02); // bottom bracket
  const seatBase = V(0, 0.355, BASE.rear + 0.09);
  g.add(tubeAlong([headBot, V(0, 0.2, 0.16), bb, V(0, 0.3, seatBase.z + 0.02), seatBase], 0.021, paint, 32));
  // seat stays + chain stays to rear axle
  g.add(tubeAlong([seatBase, V(0.015, AXLE_Y + 0.01, BASE.rear)], 0.008, paint, 8));
  g.add(tubeAlong([bb, V(0.018, AXLE_Y, BASE.rear - 0.005)], 0.008, paint, 8));
  // head tube + fork
  g.add(tubeAlong([headTop, headBot], 0.023, paint, 6));
  for (const side of [-1, 1]) {
    g.add(tubeAlong([headBot, V(side * 0.028, 0.26, BASE.front + 0.012), V(side * 0.03, AXLE_Y, BASE.front)], 0.009, paint, 10));
  }

  // handlebar: riser + swept-back bar + grips + brake levers
  const handlebar = new THREE.Group();
  handlebar.position.copy(headTop);
  const stem = tubeAlong([V(0, -0.02, 0), V(0, 0.055, 0.012)], 0.014, MAT.chrome(), 6);
  handlebar.add(stem);
  const barPts = [];
  for (const side of [-1, 1]) {
    barPts.push([V(0, 0.055, 0.012), V(side * 0.1, 0.075, 0.005), V(side * 0.17, 0.075, -0.06)]);
  }
  for (const pts of barPts) handlebar.add(tubeAlong(pts, 0.011, MAT.dark(), 12));
  for (const side of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.09, 10), MAT.rubber());
    grip.rotation.z = Math.PI / 2;
    grip.rotation.y = -side * 0.62;
    grip.position.set(side * 0.155, 0.075, -0.052);
    grip.castShadow = true;
    handlebar.add(grip);
  }
  // bell
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.25, metalness: 0.7 }));
  bell.position.set(-0.07, 0.085, 0.015);
  handlebar.add(bell);
  g.add(handlebar);

  // basket (yellow lattice) hung off the head tube
  const basket = new THREE.Group();
  const bMat = new THREE.MeshStandardMaterial({ color: 0xf5b93c, roughness: 0.55 });
  const bw = 0.24, bd = 0.17, bh = 0.16;
  const wall = (w, h, px, py, pz, ry = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.008), bMat);
    m.position.set(px, py, pz); m.rotation.y = ry; m.castShadow = true;
    basket.add(m);
  };
  // solid-ish walls with slots suggested by thin ribs
  wall(bw, bh, 0, bh / 2, bd / 2);
  wall(bw, bh, 0, bh / 2, -bd / 2);
  wall(bd, bh, bw / 2, bh / 2, 0, Math.PI / 2);
  wall(bd, bh, -bw / 2, bh / 2, 0, Math.PI / 2);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.008, bd), bMat);
  basket.add(floor);
  basket.position.set(0, 0.545, BASE.front + 0.035);
  basket.rotation.x = -0.06;
  g.add(basket);

  // saddle + post
  g.add(tubeAlong([seatBase, V(0, 0.395, BASE.rear + 0.078)], 0.012, MAT.chrome(), 6));
  const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 10), MAT.dark());
  saddle.scale.set(0.75, 0.32, 1.25);
  saddle.position.set(0, 0.41, BASE.rear + 0.065);
  saddle.castShadow = true;
  g.add(saddle);

  // chain guard (blue) + crank/pedals
  const guardMat = new THREE.MeshStandardMaterial({ color: 0x5aa7e0, roughness: 0.45 });
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.02, 24), guardMat);
  guard.rotation.z = Math.PI / 2;
  guard.scale.set(1, 1, 0.82);
  guard.position.set(0.035, bb.y + 0.01, bb.z - 0.06);
  guard.castShadow = true;
  g.add(guard);
  const guardArm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.3), guardMat);
  guardArm.position.set(0.035, bb.y + 0.02, (bb.z + BASE.rear) / 2);
  g.add(guardArm);

  const crank = new THREE.Group();
  crank.position.copy(bb);
  const pedals = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.15, 0.018), MAT.dark());
    arm.position.set(side * 0.045, side * 0.055, 0);
    crank.add(arm);
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.02, 0.05), MAT.rubber());
    pedal.position.set(side * 0.07, side * 0.11, 0);
    crank.add(pedal);
    pedals.push(pedal);
  }
  g.add(crank);

  // reflectors
  const reflMat = new THREE.MeshStandardMaterial({ color: 0xff7a3c, emissive: 0xdd4400, emissiveIntensity: 0.4, roughness: 0.3 });
  const refl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.008), reflMat);
  refl.position.set(0, 0.365, BASE.rear + 0.055);
  g.add(refl);

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  return {
    group: g,
    wheels: { front, rear, training },
    wheelRadius: WHEEL_R,
    handlebar,
    crank,
    pedals,
    saddleTop: V(0, 0.435, BASE.rear + 0.065),
    gripL: V(-0.155, 0.52 + 0.075, BASE.front - 0.035 - 0.052),
    gripR: V(0.155, 0.52 + 0.075, BASE.front - 0.035 - 0.052),
    bbPos: bb.clone(),
    crankArm: 0.11,
    paint,
    setColor(hex) { paint.color.setHex(hex); },
  };
}
