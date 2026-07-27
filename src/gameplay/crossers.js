import * as THREE from 'three';

// Little families Rae stops to watch cross the road — pure spectacle, never a
// fail. Each returns { group, update(dt, t, dist), startCrossing(), get done() }
// so the director can treat them exactly like the otters.

const mat = {
  fur: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }),
  plastic: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }),
};

// Shared crossing driver. Members walk from one verge (+x) to the other (-x);
// `done` flips once they've cleared the carriageway so the ride flows on, while
// they keep ambling off to the far side. `bob` animates each member's gait.
function crosser(g, members, { speed = 1.35, spacing = 0.5, bob } = {}) {
  let crossing = false;
  let progress = -6.5;
  return {
    group: g,
    startCrossing() { crossing = true; },
    get done() { return progress > 4.2; }, // cleared the road → safe to go
    update(dt, t, dist) {
      if (!crossing && dist < 26) crossing = true;
      if (crossing && progress <= 8.5) progress += dt * speed;
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        m.position.x = -(progress - i * spacing);
        m.rotation.y = -Math.PI / 2;
        if (bob) bob(m, i, t);
      }
    },
  };
}

// hen leading a line of fluffy chicks
export function buildHenFamily() {
  const g = new THREE.Group();
  const cream = mat.fur(0xf2ede2), chickY = mat.fur(0xf6d24a);
  const red = mat.plastic(0xd23b32), beakM = mat.plastic(0xe8a02c), legM = mat.plastic(0xe0902a);
  const mkBird = (scale, bodyMat) => {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13 * scale, 0.12 * scale, 6, 12), bodyMat);
    body.rotation.z = Math.PI / 2; body.position.y = 0.16 * scale; body.castShadow = true; b.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.085 * scale, 10, 8), bodyMat);
    head.position.set(0.12 * scale, 0.29 * scale, 0); b.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.028 * scale, 0.07 * scale, 6), beakM);
    beak.rotation.z = -Math.PI / 2; beak.position.set(0.2 * scale, 0.28 * scale, 0); b.add(beak);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.011 * scale, 0.011 * scale, 0.13 * scale, 5), legM);
      leg.position.set(0, 0.06 * scale, s * 0.04 * scale); b.add(leg);
    }
    return b;
  };
  const members = [];
  const hen = mkBird(1, cream);
  const comb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.055, 0.1), red);
  comb.position.set(0.11, 0.37, 0); hen.add(comb);
  const wattle = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), red);
  wattle.position.set(0.19, 0.24, 0); hen.add(wattle);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.17, 6), cream);
  tail.rotation.z = 0.9; tail.position.set(-0.16, 0.28, 0); hen.add(tail);
  g.add(hen); members.push(hen);
  for (let i = 0; i < 4; i++) { const c = mkBird(0.42, chickY); g.add(c); members.push(c); }
  return crosser(g, members, { speed: 1.5, spacing: 0.4, bob: (m, i, t) => { m.position.y = Math.abs(Math.sin(t * 8 + i * 1.3)) * 0.035; } });
}

// mother duck with a line of ducklings
export function buildDuckFamily() {
  const g = new THREE.Group();
  const white = mat.fur(0xf0ede4), duckY = mat.fur(0xf6cf3e), bill = mat.plastic(0xe89a2c), feet = mat.plastic(0xe89a2c);
  const mkDuck = (scale, bodyMat) => {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13 * scale, 0.16 * scale, 6, 12), bodyMat);
    body.rotation.z = Math.PI / 2 - 0.15; body.position.y = 0.15 * scale; body.castShadow = true; b.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06 * scale, 0.12 * scale, 6), bodyMat);
    tail.rotation.z = -0.5; tail.position.set(-0.2 * scale, 0.2 * scale, 0); b.add(tail);
    const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.045 * scale, 0.1 * scale, 4, 8), bodyMat);
    neck.position.set(0.16 * scale, 0.27 * scale, 0); neck.rotation.z = 0.3; b.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075 * scale, 10, 8), bodyMat);
    head.position.set(0.21 * scale, 0.35 * scale, 0); b.add(head);
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.1 * scale, 0.03 * scale, 0.06 * scale), bill);
    beak.position.set(0.29 * scale, 0.34 * scale, 0); b.add(beak);
    for (const s of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.01 * scale, 0.01 * scale, 0.11 * scale, 5), feet);
      foot.position.set(0, 0.05 * scale, s * 0.045 * scale); b.add(foot);
    }
    return b;
  };
  const members = [];
  const mum = mkDuck(1, white);
  g.add(mum); members.push(mum);
  for (let i = 0; i < 4; i++) { const d = mkDuck(0.45, duckY); g.add(d); members.push(d); }
  return crosser(g, members, { speed: 1.4, spacing: 0.42, bob: (m, i, t) => { m.rotation.z = Math.sin(t * 6 + i) * 0.12; m.position.y = Math.abs(Math.sin(t * 6 + i)) * 0.02; } });
}

// a friendly black-and-white cow, ambling across
export function buildCow() {
  const g = new THREE.Group();
  const white = mat.fur(0xf3f1ec), black = mat.fur(0x2b2b30), pink = mat.plastic(0xe0a0a6), horn = mat.plastic(0xe8ded0);
  const cow = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.62, 8, 14), white);
  body.rotation.z = Math.PI / 2; body.position.y = 0.72; body.castShadow = true; cow.add(body);
  for (const [x, y, z, r] of [[0.15, 0.9, 0.28, 0.14], [-0.2, 0.68, 0.3, 0.16], [0.05, 0.55, -0.3, 0.12], [-0.35, 0.85, -0.2, 0.1]]) {
    const spot = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), black);
    spot.position.set(x, y, z); spot.scale.set(1, 0.7, 0.5); cow.add(spot);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.3), white);
  head.position.set(0.62, 0.82, 0); head.castShadow = true; cow.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.24), pink);
  snout.position.set(0.76, 0.74, 0); cow.add(snout);
  const legs = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), white);
    ear.position.set(0.56, 0.96, s * 0.2); ear.scale.set(0.5, 1, 1.4); cow.add(ear);
    const hn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 6), horn);
    hn.position.set(0.64, 1.02, s * 0.11); hn.rotation.z = -0.3; cow.add(hn);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), black);
    eye.position.set(0.74, 0.9, s * 0.11); cow.add(eye);
  }
  for (const [x, z] of [[0.42, 0.2], [0.42, -0.2], [-0.32, 0.2], [-0.32, -0.2]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.6, 7), white);
    leg.position.set(x, 0.3, z); leg.castShadow = true; cow.add(leg);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.09, 7), black);
    hoof.position.set(x, 0.05, z); cow.add(hoof);
    legs.push(leg);
  }
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.5, 4, 6), white);
  tail.position.set(-0.66, 0.5, 0); tail.rotation.z = 0.35; cow.add(tail);
  const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), black);
  tuft.position.set(-0.78, 0.24, 0); cow.add(tuft);
  g.add(cow);
  return crosser(g, [cow], {
    speed: 1.15, spacing: 0,
    bob: (m, i, t) => {
      m.position.y = Math.sin(t * 3.2) * 0.02;
      for (let k = 0; k < legs.length; k++) legs[k].rotation.x = Math.sin(t * 3.2 + k * 1.6) * 0.35;
      tail.rotation.z = 0.35 + Math.sin(t * 1.5) * 0.25;
    },
  });
}

// two elderly folk crossing slowly, one with a walking stick
export function buildElderCrossing() {
  const g = new THREE.Group();
  const skins = [0xe8bd98, 0xd9a878];
  const coats = [0x8a94a6, 0xb08a6a];
  const legMat = new THREE.MeshStandardMaterial({ color: 0x4a4650, roughness: 0.85 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.9 });
  const stickMat = mat.plastic(0x8a5a34);
  const members = [];
  for (let i = 0; i < 2; i++) {
    const p = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: skins[i], roughness: 0.7 });
    const coat = new THREE.MeshStandardMaterial({ color: coats[i], roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.44, 6, 12), coat);
    body.position.y = 0.62; body.rotation.x = 0.18; body.castShadow = true; p.add(body); // slight hunch
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), skin);
    head.position.set(0.05, 1.0, 0); p.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), hairMat);
    hair.position.set(0.04, 1.03, 0); hair.scale.set(1, 0.7, 1); p.add(hair);
    const legs = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.28, 4, 8), coat);
      arm.position.set(0.02, 0.66, s * 0.17); arm.rotation.x = -0.3; p.add(arm);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.32, 4, 8), legMat);
      leg.position.set(0, 0.2, s * 0.07); p.add(leg); legs.push(leg);
    }
    if (i === 0) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 6), stickMat);
      stick.position.set(0.22, 0.31, 0.12); p.add(stick);
    }
    p.userData.legs = legs;
    g.add(p); members.push(p);
  }
  return crosser(g, members, {
    speed: 1.2, spacing: 0.62,
    bob: (m, i, t) => {
      const w = t * 3.6 + i * 2.2;
      m.position.y = Math.abs(Math.sin(w)) * 0.02;
      const legs = m.userData.legs;
      if (legs) { legs[0].rotation.x = Math.sin(w) * 0.3; legs[1].rotation.x = -Math.sin(w) * 0.3; }
    },
  });
}
