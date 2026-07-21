import * as THREE from 'three';
import { mulberry32 } from '../../core/prng.js';
import { concreteTexture } from '../../core/textures.js';

// Neighbourhood wet market & hawker centre: striped awnings, produce crates,
// hanging bulbs, a covered eating hall. Busy and colourful — the chapter
// where Rae names fruit and vegetables.

const AWNING = [0xe0574a, 0x3f8ac9, 0xf2b035, 0x5aae6a, 0xe07ab0];
const PRODUCE = [
  0xe8613c, 0xf2c035, 0x7bbc3c, 0xd8443c, 0xf28c28,
  0xa8d84a, 0xc94f8a, 0x6ab04a, 0xe8a33c,
];

function stripedAwning(w, d, colorA) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const x = c.getContext('2d');
  const col = '#' + new THREE.Color(colorA).getHexString();
  for (let i = 0; i < 8; i++) {
    x.fillStyle = i % 2 ? col : '#f7f4ec';
    x.fillRect(i * 16, 0, 16, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.06, d),
    new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }),
  );
  m.castShadow = true;
  return m;
}

export function buildStall(seed) {
  const rand = mulberry32(seed);
  const g = new THREE.Group();
  const w = 2.4 + rand() * 0.8, d = 1.8;
  const wood = new THREE.MeshStandardMaterial({ color: 0x9c7a52, roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8b939b, roughness: 0.5, metalness: 0.4 });

  // counter + legs
  const counter = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, d), wood);
  counter.position.y = 0.86;
  counter.castShadow = true; counter.receiveShadow = true;
  g.add(counter);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.86, 0.08), metal);
    leg.position.set(sx * (w / 2 - 0.12), 0.43, sz * (d / 2 - 0.12));
    g.add(leg);
  }
  // awning on posts
  const aw = stripedAwning(w + 0.5, d + 0.7, AWNING[Math.floor(rand() * AWNING.length)]);
  aw.position.set(0, 2.24, 0.1);
  aw.rotation.x = -0.13;
  g.add(aw);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.2, 8), metal);
    post.position.set(sx * (w / 2 - 0.05), 1.1, -d / 2 + 0.15);
    post.castShadow = true;
    g.add(post);
  }
  // produce: rows of crates with heaped goods
  for (let i = 0; i < 4; i++) {
    const cx = -w / 2 + 0.42 + i * (w - 0.7) / 3;
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.62),
      new THREE.MeshStandardMaterial({ color: [0xc0392b, 0x2f6fa8, 0x4a4a50][i % 3], roughness: 0.8 }),
    );
    crate.position.set(cx, 1.0, 0.1);
    crate.castShadow = true;
    g.add(crate);
    const heapColor = PRODUCE[Math.floor(rand() * PRODUCE.length)];
    for (let k = 0; k < 7; k++) {
      const r = 0.055 + rand() * 0.035;
      const item = new THREE.Mesh(
        new THREE.SphereGeometry(r, 8, 6),
        new THREE.MeshStandardMaterial({ color: heapColor, roughness: 0.65 }),
      );
      item.position.set(
        cx + (rand() - 0.5) * 0.36,
        1.12 + (k > 4 ? 0.07 : 0),
        0.1 + (rand() - 0.5) * 0.42,
      );
      g.add(item);
    }
  }
  // hanging bulb
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 4), new THREE.MeshStandardMaterial({ color: 0x35323a }));
  cord.position.set(0, 1.95, -0.2);
  g.add(cord);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffcc66, emissiveIntensity: 0.9, roughness: 0.3 }),
  );
  bulb.position.set(0, 1.73, -0.2);
  g.add(bulb);
  return g;
}

// covered hawker hall the stalls sit beside
export function buildHawkerHall(seed = 3) {
  const g = new THREE.Group();
  const wall = new THREE.MeshStandardMaterial({ map: concreteTexture([222, 216, 202]), roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xc06a3c, roughness: 0.8 });

  const W = 16, D = 10, H = 4.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wall);
  body.position.y = H / 2;
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  // shallow pitched roof
  for (const s of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(W + 1.2, 0.14, D / 2 + 0.9), roofMat);
    panel.position.set(0, H + 0.62, s * (D / 4));
    panel.rotation.x = s * -0.17;
    panel.castShadow = true;
    g.add(panel);
  }
  // open frontage: dark recess + pillars
  const recess = new THREE.Mesh(new THREE.BoxGeometry(W - 1.4, 2.7, 0.12), new THREE.MeshStandardMaterial({ color: 0x2b2724, roughness: 0.95 }));
  recess.position.set(0, 1.45, D / 2 + 0.02);
  g.add(recess);
  for (let i = 0; i < 5; i++) {
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.9, 0.42), wall);
    pil.position.set(-W / 2 + 1.2 + i * (W - 2.4) / 4, 1.45, D / 2 + 0.1);
    pil.castShadow = true;
    g.add(pil);
  }
  // signboard
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(W - 3, 0.85, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xd8453c, roughness: 0.6 }),
  );
  sign.position.set(0, 3.5, D / 2 + 0.16);
  g.add(sign);
  for (let i = 0; i < 4; i++) {
    const ch = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xf7e9a0, roughness: 0.5 }),
    );
    ch.position.set(-2.2 + i * 1.45, 3.5, D / 2 + 0.25);
    g.add(ch);
  }
  return g;
}

// round tables + stools outside the hall
export function buildKopiTables(seed = 7) {
  const rand = mulberry32(seed);
  const g = new THREE.Group();
  const top = new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.7 });
  const leg = new THREE.MeshStandardMaterial({ color: 0x8b939b, roughness: 0.5, metalness: 0.35 });
  const stoolCols = [0xe0574a, 0x3f8ac9, 0xf2b035, 0x5aae6a];
  for (let t = 0; t < 3; t++) {
    const tg = new THREE.Group();
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.07, 16), top);
    table.position.y = 0.74;
    table.castShadow = true;
    tg.add(table);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.74, 8), leg);
    pole.position.y = 0.37;
    tg.add(pole);
    for (let s = 0; s < 4; s++) {
      const a = (s / 4) * Math.PI * 2 + rand();
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 12),
        new THREE.MeshStandardMaterial({ color: stoolCols[s], roughness: 0.6 }));
      stool.position.set(Math.cos(a) * 0.95, 0.46, Math.sin(a) * 0.95);
      stool.castShadow = true;
      tg.add(stool);
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.46, 6), leg);
      sp.position.set(Math.cos(a) * 0.95, 0.23, Math.sin(a) * 0.95);
      tg.add(sp);
    }
    tg.position.set((t - 1) * 2.6, 0, rand() * 0.8);
    g.add(tg);
  }
  return g;
}
