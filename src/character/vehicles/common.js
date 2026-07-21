import * as THREE from 'three';

// Shared vehicle-building helpers + materials.

export const VEHICLE_COLORS = {
  white: 0xf4f4f0,
  pink: 0xf291b4,
  sky: 0x6fb7ea,
  mint: 0x8fd9b6,
  butter: 0xffd166,
  lilac: 0xb9a3e8,
};

export function paintMaterial(colorHex) {
  return new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: 0.38,
    metalness: 0.12,
    clearcoat: 0.8,
    clearcoatRoughness: 0.25,
  });
}

export const MAT = {
  tire: () => new THREE.MeshStandardMaterial({ color: 0x2c2a30, roughness: 0.92 }),
  rim: () => new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.3, metalness: 0.85 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x35323a, roughness: 0.7 }),
  chrome: () => new THREE.MeshStandardMaterial({ color: 0xcfd4da, roughness: 0.25, metalness: 0.9 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: 0x3a3740, roughness: 0.95 }),
};

export function tubeAlong(points, radius, mat, segs = 24, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, segs, radius, radial, false);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

// A spoked wheel: tire torus + rim + hub + spokes; returns group whose X axis is the axle.
export function buildWheel({ r = 0.175, tireR = 0.024, spokes = 12, spokeR = 0.0022 }) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(r - tireR * 0.4, tireR, 10, 28), MAT.tire());
  tire.rotation.y = Math.PI / 2;
  tire.castShadow = true;
  g.add(tire);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r - tireR * 1.7, 0.006, 8, 24), MAT.rim());
  rim.rotation.y = Math.PI / 2;
  g.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.035, 10), MAT.rim());
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  const spokeGeo = new THREE.CylinderGeometry(spokeR, spokeR, (r - tireR * 1.7) * 2, 4);
  const spokeMat = MAT.rim();
  for (let i = 0; i < spokes / 2; i++) {
    const s = new THREE.Mesh(spokeGeo, spokeMat);
    s.rotation.x = (i / (spokes / 2)) * Math.PI;
    g.add(s);
  }
  return g;
}
