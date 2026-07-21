import * as THREE from 'three';
import { mulberry32 } from '../../core/prng.js';
import { concreteTexture } from '../../core/textures.js';

// Street furniture: lamp posts, bus stops, PCN railings, overhead bridge,
// traffic lights, mama shop, benches. Chunky-clean primitives, real colors.

const MATS = {};
function mats() {
  if (!MATS.metal) {
    MATS.metal = new THREE.MeshStandardMaterial({ color: 0x8b939b, roughness: 0.55, metalness: 0.4 });
    MATS.greenRail = new THREE.MeshStandardMaterial({ color: 0x3e7d4e, roughness: 0.6 });
    MATS.concrete = new THREE.MeshStandardMaterial({ map: concreteTexture([200, 197, 190]), roughness: 0.95 });
    MATS.darkMetal = new THREE.MeshStandardMaterial({ color: 0x3c4148, roughness: 0.6, metalness: 0.3 });
    MATS.orangeRoof = new THREE.MeshStandardMaterial({ color: 0xc96f3a, roughness: 0.7 });
    MATS.white = new THREE.MeshStandardMaterial({ color: 0xeceff1, roughness: 0.6 });
  }
  return MATS;
}

export function buildLampPost() {
  const { metal, white } = mats();
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 5.6, 8), metal);
  pole.position.y = 2.8;
  pole.castShadow = true;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8), metal);
  arm.rotation.z = Math.PI / 2 - 0.25;
  arm.position.set(0.68, 5.5, 0);
  g.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.09, 0.2), white);
  head.position.set(1.35, 5.66, 0);
  g.add(head);
  return g;
}

export function buildBusStop() {
  const { metal, orangeRoof, darkMetal } = mats();
  const g = new THREE.Group();
  // roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.1, 1.7), orangeRoof);
  roof.position.y = 2.5;
  roof.rotation.z = 0.015;
  roof.castShadow = true;
  g.add(roof);
  // posts
  for (const px of [-2.1, 0, 2.1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8), metal);
    post.position.set(px, 1.25, -0.7);
    post.castShadow = true;
    g.add(post);
  }
  // bench
  const bench = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.06, 0.4), darkMetal);
  bench.position.set(0, 0.45, -0.55);
  g.add(bench);
  for (const px of [-1.6, 0, 1.6]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.35), darkMetal);
    leg.position.set(px, 0.22, -0.55);
    g.add(leg);
  }
  // sign pole with route plate
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.1, 8), metal);
  pole.position.set(2.5, 1.55, 0.5);
  g.add(pole);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.04), new THREE.MeshStandardMaterial({ color: 0xf0c945, roughness: 0.5 }));
  plate.position.set(2.5, 2.9, 0.5);
  g.add(plate);
  return g;
}

// A run of green PCN railings along the route between s0..s1 at lateral d.
export function buildRailingRun(route, terrain, s0, s1, d) {
  const { greenRail } = mats();
  const g = new THREE.Group();
  const step = 2.0;
  const railGeos = [];
  const P = new THREE.Vector3();
  let prevTop = null;
  for (let s = s0; s <= s1; s += step) {
    const h = terrain.heightAt(s, d);
    route.lateral(s, d, h, P);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.0, 0.07), greenRail);
    post.position.set(P.x, P.y + 0.5, P.z);
    post.castShadow = true;
    g.add(post);
    const top = new THREE.Vector3(P.x, P.y + 0.98, P.z);
    if (prevTop) {
      const mid = prevTop.clone().lerp(top, 0.5);
      const len = prevTop.distanceTo(top);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, len + 0.05), greenRail);
      rail.position.copy(mid);
      rail.lookAt(top);
      g.add(rail);
      const rail2 = rail.clone();
      rail2.position.y -= 0.42;
      g.add(rail2);
    }
    prevTop = top;
  }
  return g;
}

export function buildTrafficLight() {
  const { metal, darkMetal } = mats();
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.6, 10), metal);
  pole.position.y = 2.3;
  pole.castShadow = true;
  g.add(pole);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.15, 0.3), darkMetal);
  housing.position.set(0, 4.0, 0.12);
  housing.castShadow = true;
  g.add(housing);
  const lights = {};
  const defs = [['red', 0xe23b2e, 0.36], ['amber', 0xf2a52e, 0], ['green', 0x35c05a, -0.36]];
  for (const [name, color, dy] of defs) {
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.06, 16),
      new THREE.MeshStandardMaterial({ color: 0x181a1c, emissive: color, emissiveIntensity: 0.05, roughness: 0.4 }),
    );
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(0, 4.0 + dy, 0.3);
    g.add(lamp);
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.12, 12, 1, true, Math.PI, Math.PI), darkMetal);
    hood.rotation.x = Math.PI / 2 + 0.35;
    hood.position.set(0, 4.06 + dy, 0.33);
    g.add(hood);
    lights[name] = lamp;
  }
  const setState = (state) => {
    lights.red.material.emissiveIntensity = state === 'red' ? 2.4 : 0.05;
    lights.amber.material.emissiveIntensity = state === 'amber' ? 2.4 : 0.05;
    lights.green.material.emissiveIntensity = state === 'green' ? 2.4 : 0.05;
  };
  setState('green');
  return { group: g, setState };
}

// simple smooth car for crossings/parked color
export function buildCar(color = 0xd8dade) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.15, clearcoat: 0.7, clearcoatRoughness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2c3a46, roughness: 0.15, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 2.4, 6, 12), paint);
  body.rotation.z = Math.PI / 2;
  body.scale.set(1, 0.62, 1.1);
  body.position.y = 0.52;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.1, 6, 12), glass);
  cabin.rotation.z = Math.PI / 2;
  cabin.scale.set(1, 0.55, 0.95);
  cabin.position.set(-0.1, 0.94, 0);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 14);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x232326, roughness: 0.9 });
  for (const [wx, wz] of [[-0.95, 0.62], [-0.95, -0.62], [0.95, 0.62], [0.95, -0.62]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.3, wz);
    g.add(w);
  }
  // face the +Z direction (rotate so long axis is z)
  g.rotation.y = Math.PI / 2;
  const wrapper = new THREE.Group();
  wrapper.add(g);
  return wrapper;
}

// two-storey mama shop / kopitiam corner
export function buildMamaShop(seed = 1) {
  const rand = mulberry32(seed);
  const { concrete } = mats();
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(7, 6.4, 6), concrete);
  body.position.y = 3.2;
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  // five-foot-way canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.12, 2.2), new THREE.MeshStandardMaterial({ color: 0xd85f4e, roughness: 0.7 }));
  canopy.position.set(0, 3.0, 4.0);
  canopy.castShadow = true;
  g.add(canopy);
  for (const px of [-3.2, 0, 3.2]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.2), MATS.darkMetal);
    strut.position.set(px, 3.06, 4.0);
    g.add(strut);
  }
  // shopfront: dark opening + colorful sign
  const front = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.6, 0.1), new THREE.MeshStandardMaterial({ color: 0x2e2a28, roughness: 0.9 }));
  front.position.set(0, 1.4, 3.02);
  g.add(front);
  const signColors = [0xf2b035, 0x5aa7e0, 0xe86a5a];
  const sign = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.9, 0.14), new THREE.MeshStandardMaterial({ color: signColors[Math.floor(rand() * 3)], roughness: 0.5 }));
  sign.position.set(0, 3.6, 3.06);
  g.add(sign);
  // drink crates + produce boxes out front
  for (let i = 0; i < 4; i++) {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.4, 0.55),
      new THREE.MeshStandardMaterial({ color: [0xd85f4e, 0x5a8fd0, 0xf2b035, 0x6fae6a][i], roughness: 0.8 }),
    );
    crate.position.set(-2.4 + i * 0.7, 0.2 + (i % 2) * 0.42, 3.6);
    crate.castShadow = true;
    g.add(crate);
  }
  return g;
}

// pedestrian overhead bridge spanning the road
export function buildOverheadBridge() {
  const { concrete, greenRail } = mats();
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 14), concrete);
  deck.position.y = 5.2;
  deck.castShadow = true;
  g.add(deck);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 0.09), greenRail);
    rail.position.set(0, 5.95, side * 6.95);
    g.add(rail);
    // support columns
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 5.05, 10), concrete);
    col.position.set(0, 2.5, side * 6.2);
    col.castShadow = true;
    g.add(col);
    // stair blocks angling down
    const stair = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 5.4), concrete);
    stair.position.set(0, 3.4, side * 9.4);
    stair.rotation.x = side * 0.62;
    stair.castShadow = true;
    g.add(stair);
    const srail = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.9, 0.08), greenRail);
    srail.position.set(0, 4.3, side * 8.2);
    srail.rotation.x = side * 0.62;
    g.add(srail);
  }
  // side mesh panels along the deck
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 1.05, 13.6),
      new THREE.MeshStandardMaterial({ color: 0x9fb8a8, roughness: 0.7, transparent: true, opacity: 0.75 }),
    );
    panel.position.set(side * 1.18, 5.9, 0);
    g.add(panel);
  }
  return g;
}

export function buildBench() {
  const { darkMetal } = mats();
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x9a6b47, roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.12), wood);
    slat.position.set(0, 0.45, -0.14 + i * 0.14);
    slat.castShadow = true;
    g.add(slat);
  }
  for (const side of [-0.65, 0.65]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.42), darkMetal);
    leg.position.set(side, 0.22, 0);
    g.add(leg);
  }
  return g;
}
