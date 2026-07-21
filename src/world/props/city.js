import * as THREE from 'three';

// Distant Singapore skyline silhouettes — MBS, the Flyer, Esplanade, CBD
// towers — haze-tinted flat-ish materials so they sit in atmosphere.

function hazeMat(base = 0x8fa3c4, lift = 0.25) {
  const c = new THREE.Color(base).lerp(new THREE.Color(0xdfe8f2), lift);
  return new THREE.MeshBasicMaterial({ color: c, fog: true });
}

export function buildSkyline() {
  const g = new THREE.Group();
  const far = hazeMat(0x8fa3c4, 0.42);
  const mid = hazeMat(0x7c93b8, 0.22);

  // Marina Bay Sands: three towers + skypark
  const mbs = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(9, 58, 7), mid);
    tower.position.set(i * 13 - 13, 29, 0);
    // slight lean on outer towers
    tower.rotation.z = (i - 1) * 0.025;
    mbs.add(tower);
  }
  const park = new THREE.Mesh(new THREE.CapsuleGeometry(3.4, 44, 4, 10), mid);
  park.rotation.z = Math.PI / 2;
  park.position.set(0, 60.5, 0);
  mbs.add(park);
  mbs.position.set(0, 0, 0);
  g.add(mbs);

  // Singapore Flyer
  const flyer = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(21, 1.1, 8, 40), far);
  rim.position.y = 27;
  flyer.add(rim);
  for (let i = 0; i < 8; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.9, 42, 0.9), far);
    spoke.position.y = 27;
    spoke.rotation.z = (i / 8) * Math.PI;
    flyer.add(spoke);
  }
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 30, 1.6), far);
    leg.position.set(s * 7, 13, 2);
    leg.rotation.z = s * 0.42;
    flyer.add(leg);
  }
  flyer.position.set(58, 0, 6);
  g.add(flyer);

  // Esplanade domes (the durians)
  for (const s of [-1, 1]) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(9, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mid);
    dome.scale.set(1.15, 0.8, 1);
    dome.position.set(-44 + s * 10.5, 0, 8);
    g.add(dome);
  }

  // CBD tower cluster behind
  const heights = [70, 88, 62, 96, 74, 58, 82, 66];
  for (let i = 0; i < heights.length; i++) {
    const w = 10 + (i % 3) * 4;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w, heights[i], w), far);
    tower.position.set(-110 + i * 17 + (i % 2) * 5, heights[i] / 2, -34 - (i % 3) * 16);
    g.add(tower);
  }

  return g;
}
