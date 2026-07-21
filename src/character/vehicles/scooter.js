import * as THREE from 'three';
import { paintMaterial, MAT, tubeAlong } from './common.js';

// Rae's real scooter: white KUB 3-wheeler with green deck pad — two front
// wheels, one rear, T-bar stem. +Z = forward.

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function scooterWheel(r, w) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 18), MAT.rubber());
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  g.add(tire);
  const hubcap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.004, 12), new THREE.MeshStandardMaterial({ color: 0xf0f0ec, roughness: 0.4 }));
  hubcap.rotation.z = Math.PI / 2;
  g.add(hubcap);
  return g;
}

export function buildScooter({ deckColor = 0x8fd05c, frameColor = 0xf4f4f0 } = {}) {
  const g = new THREE.Group();
  const paint = paintMaterial(frameColor);
  const accent = new THREE.MeshStandardMaterial({ color: deckColor, roughness: 0.6 });

  // deck: rounded white board with green grip pad
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.035, 0.5), paint);
  deck.position.set(0, 0.062, -0.1);
  deck.castShadow = true;
  g.add(deck);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.01, 0.4), accent);
  pad.position.set(0, 0.085, -0.11);
  g.add(pad);
  // rear brake fender
  const fender = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.06, 12, 1, false, -Math.PI * 0.15, Math.PI * 0.75), new THREE.MeshStandardMaterial({ color: 0xd8d8d2, roughness: 0.6 }));
  fender.rotation.z = Math.PI / 2;
  fender.position.set(0, 0.075, -0.335);
  g.add(fender);

  // rear wheel
  const rear = scooterWheel(0.055, 0.038);
  rear.position.set(0, 0.055, -0.33);
  g.add(rear);

  // front: stem base with two wheels
  const stemBase = V(0, 0.09, 0.13);
  const front = new THREE.Group(); // steerable assembly
  front.position.copy(stemBase);
  const wheels = [];
  for (const side of [-1, 1]) {
    const w = scooterWheel(0.06, 0.042);
    w.position.set(side * 0.062, 0.06 - stemBase.y, 0.02);
    front.add(w);
    wheels.push(w);
  }
  // stem: white column with green clamp, tilted slightly back
  const stemTop = V(0, 0.62, 0.055);
  const stemDir = stemTop.clone().sub(V(0, 0.02, 0.06));
  front.add(tubeAlong([V(0, 0, 0.01), V(0, 0.24, 0.0), V(0, stemTop.y - stemBase.y, stemTop.z - stemBase.z)], 0.019, paint, 10));
  const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.055, 10), accent);
  clamp.position.set(0, 0.3, -0.008);
  clamp.rotation.x = 0.08;
  front.add(clamp);
  // T-bar + grips
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.3, 10), MAT.dark());
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, stemTop.y - stemBase.y, stemTop.z - stemBase.z);
  front.add(bar);
  for (const side of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.085, 10), MAT.rubber());
    grip.rotation.z = Math.PI / 2;
    grip.position.set(side * 0.145, stemTop.y - stemBase.y, stemTop.z - stemBase.z);
    grip.castShadow = true;
    front.add(grip);
  }
  g.add(front);

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  return {
    group: g,
    front,           // rotate .y to steer
    wheels: { front: wheels, rear },
    wheelRadius: 0.06,
    deckTopY: 0.095,
    deckStandZ: -0.02,
    gripL: V(-0.145, stemBase.y + stemTop.y - stemBase.y, stemBase.z + stemTop.z - stemBase.z),
    gripR: V(0.145, stemBase.y + stemTop.y - stemBase.y, stemBase.z + stemTop.z - stemBase.z),
    paint,
    accent,
    setColor(hex) { paint.color.setHex(hex); },
  };
}
