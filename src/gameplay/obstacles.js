import * as THREE from 'three';
import { mulberry32 } from '../core/prng.js';

// Real-life obstacles + animal moments. Each returns {group, update(dt, t, dist)}.

const M = {
  fur: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }),
  plastic: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }),
};

export function buildSleepingCat() {
  const g = new THREE.Group();
  const fur = M.fur(0xc9873e);
  const furDark = M.fur(0xa96a2c);
  const body = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.1, 10, 18, Math.PI * 1.7), fur);
  body.rotation.x = -Math.PI / 2;
  body.position.y = 0.1;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), fur);
  head.position.set(0.17, 0.12, 0.05);
  head.castShadow = true;
  g.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.06, 6), furDark);
    ear.position.set(0.17 + s * 0.055, 0.21, 0.05);
    g.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.3, 4, 8), furDark);
  tail.rotation.z = Math.PI / 2 - 0.3;
  tail.position.set(-0.12, 0.06, -0.12);
  g.add(tail);
  // stripes
  for (let i = 0; i < 3; i++) {
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 10, Math.PI), furDark);
    stripe.rotation.x = -Math.PI / 2 + 0.2;
    stripe.rotation.z = i * 0.8;
    stripe.position.set(-0.05 + i * 0.06, 0.16, 0);
    g.add(stripe);
  }
  const earL = g.children[2];
  return {
    group: g,
    update(dt, t) {
      g.scale.y = 1 + Math.sin(t * 2.1) * 0.03; // breathing
      earL.rotation.z = Math.sin(t * 0.7) > 0.96 ? 0.3 : 0; // occasional flick
    },
  };
}

export function buildPigeons(seed = 1) {
  const g = new THREE.Group();
  const rand = mulberry32(seed);
  const birds = [];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.08, 4, 8), M.fur(0x8a8f98));
    body.rotation.x = Math.PI / 2 - 0.3;
    body.position.y = 0.07;
    body.castShadow = true;
    b.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), M.fur(0x5d6470));
    head.position.set(0, 0.13, 0.06);
    b.add(head);
    const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.14), M.fur(0x7a808a));
    wingL.position.set(-0.05, 0.09, -0.01);
    wingL.rotation.y = 0.3;
    b.add(wingL);
    const wingR = wingL.clone();
    wingR.position.x = 0.05;
    wingR.rotation.y = -0.3;
    b.add(wingR);
    b.position.set((rand() - 0.5) * 1.4, 0, (rand() - 0.5) * 1.2);
    b.rotation.y = rand() * Math.PI * 2;
    b.userData = { phase: rand() * 10, flying: 0, vel: new THREE.Vector3(), wingL, wingR };
    g.add(b);
    birds.push(b);
  }
  return {
    group: g,
    update(dt, t, dist) {
      for (const b of birds) {
        const u = b.userData;
        if (dist < 7 && u.flying === 0) {
          u.flying = 0.001;
          u.vel.set((Math.random() - 0.5) * 3, 4.5 + Math.random() * 2, -(2 + Math.random() * 2));
        }
        if (u.flying > 0) {
          u.flying += dt;
          b.position.addScaledVector(u.vel, dt);
          u.vel.y -= dt * 1.1;
          u.wingL.rotation.z = Math.sin(u.flying * 26) * 0.9;
          u.wingR.rotation.z = -Math.sin(u.flying * 26) * 0.9;
          b.rotation.y += dt * 0.6;
        } else {
          // peck about
          b.position.x += Math.sin(t * 0.8 + u.phase) * dt * 0.12;
          b.children[1].position.y = 0.13 - (Math.sin(t * 3.1 + u.phase) > 0.7 ? 0.05 : 0);
        }
      }
    },
  };
}

export function buildPuddle() {
  const g = new THREE.Group();
  const puddle = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 22),
    new THREE.MeshStandardMaterial({ color: 0x3d4c58, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.9 }),
  );
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.y = 0.015;
  puddle.scale.set(1, 0.7, 1);
  g.add(puddle);
  return { group: g, update() {} };
}

export function buildBeachBall() {
  const g = new THREE.Group();
  const ball = new THREE.Group();
  const segs = [0xe05545, 0xf6f4f0, 0x3f7ec9, 0xf2c035, 0xe05545, 0xf6f4f0];
  for (let i = 0; i < 6; i++) {
    const wedge = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 12, (i / 6) * Math.PI * 2, Math.PI / 3),
      M.plastic(segs[i]),
    );
    wedge.castShadow = true;
    ball.add(wedge);
  }
  ball.position.y = 0.32;
  g.add(ball);
  return {
    group: g,
    update(dt, t) {
      ball.position.y = 0.32 + Math.abs(Math.sin(t * 2.4)) * 0.35;
      ball.rotation.y = t * 0.8;
    },
  };
}

export function buildCone() {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.62, 14), M.plastic(0xe8683c));
  cone.position.y = 0.34;
  cone.castShadow = true;
  g.add(cone);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.17, 0.12, 14), M.plastic(0xf6f4f0));
  band.position.y = 0.38;
  g.add(band);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), M.plastic(0xe8683c));
  base.position.y = 0.026;
  g.add(base);
  return { group: g, update() {} };
}

// simple adult figure with a market trolley
export function buildAuntie() {
  const g = new THREE.Group();
  const dress = new THREE.MeshStandardMaterial({ color: 0xb06a9c, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8bd98, roughness: 0.65 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x4a4a50, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 6, 12), dress);
  body.position.y = 0.72;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), skin);
  head.position.y = 1.2;
  head.castShadow = true;
  g.add(head);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), hair);
  bun.position.set(0, 1.24, -0.03);
  bun.scale.set(1, 0.85, 0.95);
  g.add(bun);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.3, 4, 8), skin);
    arm.position.set(s * 0.2, 0.78, 0.08);
    arm.rotation.x = -0.5;
    g.add(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.3, 4, 8), skin);
    leg.position.set(s * 0.08, 0.22, 0);
    g.add(leg);
  }
  // trolley
  const trolley = new THREE.Group();
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.28), new THREE.MeshStandardMaterial({ color: 0xc03a3a, roughness: 0.7 }));
  basket.position.y = 0.45;
  basket.castShadow = true;
  trolley.add(basket);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), M.plastic(0x35323a));
  handle.position.set(0, 0.75, -0.12);
  handle.rotation.x = 0.4;
  trolley.add(handle);
  for (const s of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 10), M.plastic(0x35323a));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(s * 0.14, 0.06, 0.05);
    trolley.add(wheel);
  }
  trolley.position.set(0.42, 0, 0.25);
  g.add(trolley);
  return {
    group: g,
    update(dt, t) {
      g.rotation.z = Math.sin(t * 1.1) * 0.02;
      head.rotation.y = Math.sin(t * 0.4) * 0.4;
    },
  };
}

// otter family that waddles across the road — a spectacle stop, not a fail
export function buildOtterFamily() {
  const g = new THREE.Group();
  const otters = [];
  for (let i = 0; i < 4; i++) {
    const o = new THREE.Group();
    const scale = i === 0 ? 1 : 0.72;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.09 * scale, 0.3 * scale, 6, 10), M.fur(0x6a4f38));
    body.rotation.x = Math.PI / 2 - 0.25;
    body.position.y = 0.1 * scale;
    body.castShadow = true;
    o.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075 * scale, 10, 8), M.fur(0x7a5c42));
    head.position.set(0, 0.17 * scale, 0.18 * scale);
    o.add(head);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.035 * scale, 8, 6), M.fur(0xc9b49a));
    snout.position.set(0, 0.15 * scale, 0.25 * scale);
    o.add(snout);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.035 * scale, 0.22 * scale, 4, 8), M.fur(0x5d4530));
    tail.rotation.x = Math.PI / 2 + 0.35;
    tail.position.set(0, 0.07 * scale, -0.22 * scale);
    o.add(tail);
    o.position.set(0, 0, -i * 0.55);
    o.userData.phase = i * 1.4;
    g.add(o);
    otters.push(o);
  }
  let crossing = false;
  let progress = -6; // lateral start (right side), waddle to the left
  return {
    group: g,
    startCrossing() { crossing = true; },
    get done() { return progress > 7; },
    update(dt, t, dist) {
      if (!crossing && dist < 26) crossing = true;
      if (crossing && progress <= 7) progress += dt * 1.35;
      for (let i = 0; i < otters.length; i++) {
        const o = otters[i];
        o.position.x = -(progress - i * 0.55);
        o.position.z = 0;
        o.position.y = Math.abs(Math.sin(t * 7 + o.userData.phase)) * 0.05;
        o.rotation.y = -Math.PI / 2;
      }
    },
  };
}
