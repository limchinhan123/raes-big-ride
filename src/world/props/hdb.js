import * as THREE from 'three';
import { mulberry32 } from '../../core/prng.js';
import { hdbFacade, concreteTexture } from '../../core/textures.js';

// Modular HDB block: textured facade + real geometry for floor ledges, void
// deck pillars, roof furniture. Reads correctly from 15m+ out.

const PALETTES = [
  { body: '#e9e4da', accent: '#e8a8bc', accent2: '#89aed2' },
  { body: '#e7e9e4', accent: '#8fb8d8', accent2: '#e0b48a' },
  { body: '#efe8d9', accent: '#d8927a', accent2: '#a8c0a0' },
  { body: '#e4e6ea', accent: '#b09ac8', accent2: '#e8c07a' },
  { body: '#ece5d8', accent: '#7fb0a0', accent2: '#e8a8bc' },
];

let _concrete = null, _concreteDark = null;
function mats() {
  if (!_concrete) {
    _concrete = new THREE.MeshStandardMaterial({ map: concreteTexture([222, 218, 210]), roughness: 0.95 });
    _concreteDark = new THREE.MeshStandardMaterial({ map: concreteTexture([168, 165, 158]), roughness: 0.95 });
  }
  return { concrete: _concrete, dark: _concreteDark };
}

export function buildHDB({ seed = 1, floors = 12, bays = 8, paletteIndex = 0, emissiveIntensity = 0 }) {
  const rand = mulberry32(seed * 7 + 3);
  const pal = PALETTES[paletteIndex % PALETTES.length];
  const { concrete, dark } = mats();

  const W = bays * 3.35;
  const VOID_H = 3.6;
  const FLOOR_H = 2.85;
  const H = VOID_H + floors * FLOOR_H;
  const D = 11;

  const g = new THREE.Group();

  const { map, emissive } = hdbFacade({ floors, bays, ...pal, seed });
  const facadeMat = new THREE.MeshStandardMaterial({
    map, roughness: 0.92,
    emissiveMap: emissive, emissive: new THREE.Color(0xffb45c),
    emissiveIntensity,
  });
  const sideMat = new THREE.MeshStandardMaterial({
    map: concreteTexture([parseInt(pal.body.slice(1, 3), 16), parseInt(pal.body.slice(3, 5), 16), parseInt(pal.body.slice(5, 7), 16)]),
    roughness: 0.95,
  });

  // main slab: front/back get the facade, sides get tinted concrete
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, D),
    [sideMat, sideMat, concrete, concrete, facadeMat, facadeMat],
  );
  slab.position.y = H / 2;
  slab.castShadow = true; slab.receiveShadow = true;
  g.add(slab);

  // floor ledges (front + back) — the horizontal shadow lines that sell depth
  const ledgeGeo = new THREE.BoxGeometry(W + 0.3, 0.14, 0.5);
  for (let f = 0; f <= floors; f++) {
    const y = VOID_H + f * FLOOR_H;
    for (const side of [1, -1]) {
      const ledge = new THREE.Mesh(ledgeGeo, concrete);
      ledge.position.set(0, y, side * (D / 2 + 0.18));
      ledge.castShadow = true;
      g.add(ledge);
    }
  }

  // void deck pillars
  const pillarGeo = new THREE.BoxGeometry(0.55, VOID_H, 0.55);
  const pillars = Math.floor(W / 5.6);
  for (let p = 0; p <= pillars; p++) {
    const px = -W / 2 + (p / pillars) * W;
    for (const side of [1, -1]) {
      const pil = new THREE.Mesh(pillarGeo, concrete);
      pil.position.set(px, VOID_H / 2, side * (D / 2 - 0.6));
      pil.castShadow = true;
      g.add(pil);
    }
  }

  // roof: parapet, lift tower, water tanks
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.9, D + 0.4), concrete);
  parapet.position.y = H + 0.45;
  g.add(parapet);
  const lift = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.4, 3.4), sideMat);
  lift.position.set(-W / 2 + 3.4 + rand() * (W - 7), H + 2.5, 0);
  lift.castShadow = true;
  g.add(lift);
  for (let t = 0; t < 2; t++) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 1.7, 12), dark);
    tank.position.set(lift.position.x + 3.4 + t * 2.6, H + 1.8, -1.4 + t * 2.4);
    tank.castShadow = true;
    g.add(tank);
  }

  g.userData = { width: W, height: H, depth: D, facadeMat };
  return g;
}

// bamboo laundry poles with drying clothes, mounted off a facade
export function buildLaundry(seed) {
  const rand = mulberry32(seed);
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xb8a878, roughness: 0.8 });
  const colors = [0xe88bb0, 0x7cc0ee, 0xffd166, 0xeef0f2, 0x9fdcc0, 0xd98a6a];
  const n = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i++) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), poleMat);
    pole.rotation.x = Math.PI / 2;
    pole.position.set((rand() - 0.5) * 1.5, -i * 0.55, 1.2);
    g.add(pole);
    const clothes = 2 + Math.floor(rand() * 2);
    for (let c2 = 0; c2 < clothes; c2++) {
      const w = 0.4 + rand() * 0.3, h = 0.55 + rand() * 0.35;
      const cloth = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({
          color: colors[Math.floor(rand() * colors.length)],
          side: THREE.DoubleSide, roughness: 0.9,
        }),
      );
      cloth.position.set(pole.position.x - 0.8 + c2 * 0.7 + rand() * 0.2, pole.position.y - h / 2 - 0.02, 1.2);
      cloth.castShadow = true;
      g.add(cloth);
    }
  }
  return g;
}
