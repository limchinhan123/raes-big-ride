import * as THREE from 'three';
import { mulberry32 } from '../../core/prng.js';

// The finale: a modern HDB playground — tower with tube slide, straight
// slide, rope bridge, spring riders, rubber safety floor — plus Rae's
// plushie friends and a balloon arch.

const PMAT = {};
function mats() {
  if (!PMAT.red) {
    PMAT.red = new THREE.MeshStandardMaterial({ color: 0xe05545, roughness: 0.45 });
    PMAT.yellow = new THREE.MeshStandardMaterial({ color: 0xf2c035, roughness: 0.45 });
    PMAT.blue = new THREE.MeshStandardMaterial({ color: 0x3f7ec9, roughness: 0.45 });
    PMAT.green = new THREE.MeshStandardMaterial({ color: 0x5aae6a, roughness: 0.45 });
    PMAT.postMetal = new THREE.MeshStandardMaterial({ color: 0x7a8288, roughness: 0.5, metalness: 0.4 });
    PMAT.rope = new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.9 });
    PMAT.pink = new THREE.MeshStandardMaterial({ color: 0xf291b4, roughness: 0.45 });
  }
  return PMAT;
}

function rubberFloor() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#4f7d62';
  x.fillRect(0, 0, 512, 512);
  const rand = mulberry32(88);
  // speckle
  for (let i = 0; i < 4200; i++) {
    x.fillStyle = `rgba(${30 + rand() * 60 | 0},${60 + rand() * 50 | 0},${45 + rand() * 40 | 0},0.5)`;
    x.fillRect(rand() * 512, rand() * 512, 2, 2);
  }
  // colored circles
  const circles = [['#e0a33c', 130, 150, 78], ['#c96f5a', 350, 300, 96], ['#5a8fc0', 180, 390, 60], ['#d8b23a', 400, 110, 48]];
  for (const [col, cx, cy, r] of circles) {
    x.fillStyle = col;
    x.globalAlpha = 0.85;
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    x.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildPlayground() {
  const m = mats();
  const g = new THREE.Group();

  // rubber floor pad
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(11, 11, 0.12, 36),
    new THREE.MeshStandardMaterial({ map: rubberFloor(), roughness: 0.92 }),
  );
  floor.position.y = 0.06;
  floor.receiveShadow = true;
  g.add(floor);

  // main tower A (with roof) + tower B, linked by rope bridge
  const towerA = new THREE.Vector3(-2.6, 0, -1.2);
  const towerB = new THREE.Vector3(2.4, 0, 0.6);
  const platforms = [];
  for (const [pos, h, roofMat] of [[towerA, 1.55, m.red], [towerB, 1.25, m.blue]]) {
    const t = new THREE.Group();
    t.position.copy(pos);
    // posts
    for (const [px, pz] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, h + 1.9, 10), m.postMetal);
      post.position.set(px, (h + 1.9) / 2, pz);
      post.castShadow = true;
      t.add(post);
    }
    // platform deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.09, 1.8), m.yellow);
    deck.position.y = h;
    deck.castShadow = true;
    t.add(deck);
    // guard panels
    for (const side of [[0, -0.88, 0], [0, 0.88, 0], [-0.88, 0, 1], [0.88, 0, 1]]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(side[2] ? 0.06 : 1.7, 0.62, side[2] ? 1.7 : 0.06), m.green);
      panel.position.set(side[0], h + 0.42, side[1]);
      t.add(panel);
    }
    // pitched roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.95, 4), roofMat);
    roof.position.y = h + 1.75;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    t.add(roof);
    g.add(t);
    platforms.push({ group: t, h, pos });
  }

  // tube slide from tower A: torus segment + exit
  const tube = new THREE.Mesh(
    new THREE.TorusGeometry(1.7, 0.42, 14, 22, Math.PI * 0.9),
    m.yellow,
  );
  tube.position.set(towerA.x - 1.1, 1.05, towerA.z - 0.6);
  tube.rotation.set(Math.PI / 2, 0, 2.4);
  tube.castShadow = true;
  g.add(tube);
  const tubeExit = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.5, 0.7, 16, 1, true), m.yellow);
  tubeExit.position.set(towerA.x - 2.75, 0.42, towerA.z - 1.75);
  tubeExit.rotation.z = 1.25;
  tubeExit.rotation.y = 0.5;
  g.add(tubeExit);

  // straight slide from tower B
  const slide = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 2.6), m.red);
  bed.castShadow = true;
  slide.add(bed);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 2.6), m.red);
    rail.position.set(side * 0.32, 0.11, 0);
    slide.add(rail);
  }
  slide.position.set(towerB.x + 1.15, 0.72, towerB.z + 1.15);
  slide.rotation.x = -0.06;
  slide.rotation.y = 0.8;
  slide.rotation.x = 0.5;
  g.add(slide);

  // rope bridge between towers
  const span = towerB.clone().sub(towerA);
  const spanLen = span.length();
  const bridgeDir = span.clone().normalize();
  const bridgeAngle = Math.atan2(bridgeDir.x, bridgeDir.z);
  const planks = 7;
  for (let i = 0; i < planks; i++) {
    const t = (i + 0.5) / planks;
    const sag = Math.sin(t * Math.PI) * -0.14;
    const p = towerA.clone().lerp(towerB, t);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.24), m.yellow);
    plank.position.set(p.x, 1.42 + sag, p.z);
    plank.rotation.y = bridgeAngle;
    plank.castShadow = true;
    g.add(plank);
  }
  for (const side of [-1, 1]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, spanLen - 0.4, 6), m.rope);
    const mid = towerA.clone().lerp(towerB, 0.5);
    rope.position.set(mid.x + Math.cos(bridgeAngle) * side * 0.36, 1.95, mid.z - Math.sin(bridgeAngle) * side * 0.36);
    rope.rotation.z = Math.PI / 2;
    rope.rotation.y = bridgeAngle + Math.PI / 2;
    g.add(rope);
  }

  // spring riders: pony & bee
  for (const [dx, dz, mat] of [[3.6, -2.6, m.pink], [4.7, -1.4, m.yellow]]) {
    const rider = new THREE.Group();
    const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.4, 10), m.postMetal);
    spring.position.y = 0.2;
    rider.add(spring);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.4, 6, 10), mat);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.58;
    body.castShadow = true;
    rider.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mat);
    head.position.set(0.32, 0.72, 0);
    rider.add(head);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), m.postMetal);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0.22, 0.78, 0);
    rider.add(handle);
    rider.position.set(dx, 0, dz);
    g.add(rider);
  }

  // climbing arch
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.07, 10, 20, Math.PI), m.blue);
  arch.position.set(-4.4, 0.1, 1.8);
  g.add(arch);
  for (let i = 1; i < 5; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.24 * Math.sin((i / 5) * Math.PI) * 0.9, 6), m.postMetal);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(-4.4, 0.1 + Math.sin((i / 5) * Math.PI) * 1.12 * 0.85, 1.8 - Math.cos((i / 5) * Math.PI) * 1.15 * 0);
    g.add(rung);
  }

  return g;
}

// Rae's real plushies, waiting on a bench: white unicorn + green caterpillar
export function buildPlushies() {
  const g = new THREE.Group();
  // unicorn: white body, pink mane, gold horn
  const uni = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f4f0, roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.24, 6, 12), white);
  body.rotation.z = Math.PI / 2 - 0.25;
  body.position.y = 0.2;
  uni.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), white);
  head.position.set(0.2, 0.42, 0);
  uni.add(head);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0xf0c04a, roughness: 0.4 }));
  horn.position.set(0.24, 0.6, 0);
  uni.add(horn);
  const maneMat = new THREE.MeshStandardMaterial({ color: 0xf291b4, roughness: 0.8 });
  for (let i = 0; i < 4; i++) {
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), maneMat);
    tuft.position.set(0.1 - i * 0.07, 0.47 - i * 0.03, 0);
    uni.add(tuft);
  }
  for (const [ex, ez] of [[-0.1, 0.08], [-0.1, -0.08], [0.14, 0.08], [0.14, -0.08]]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.08, 4, 8), white);
    leg.position.set(ex, 0.08, ez);
    uni.add(leg);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), new THREE.MeshStandardMaterial({ color: 0x2a2422 }));
  eye.position.set(0.31, 0.44, 0.08);
  uni.add(eye);
  uni.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.add(uni);

  // caterpillar: chain of green balls with a smiley face
  const cat = new THREE.Group();
  const greenA = new THREE.MeshStandardMaterial({ color: 0xa8d84a, roughness: 0.8 });
  const greenB = new THREE.MeshStandardMaterial({ color: 0x7bbc3c, roughness: 0.8 });
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(0.12 - i * 0.008, 12, 10), i % 2 ? greenA : greenB);
    seg.position.set(-0.5 + i * 0.19, 0.12, Math.sin(i * 1.2) * 0.05);
    seg.castShadow = true;
    cat.add(seg);
  }
  const headC = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), greenA);
  headC.position.set(0.44, 0.16, 0);
  headC.castShadow = true;
  cat.add(headC);
  for (const s of [-1, 1]) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 6), greenB);
    ant.position.set(0.5, 0.32, s * 0.05);
    ant.rotation.z = -0.3;
    cat.add(ant);
    const eyeC = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), new THREE.MeshStandardMaterial({ color: 0x2a2422 }));
    eyeC.position.set(0.55, 0.2, s * 0.055);
    cat.add(eyeC);
  }
  cat.position.set(0.9, 0, 0.1);
  g.add(cat);

  return g;
}

export function buildBalloonArch(timeU) {
  const g = new THREE.Group();
  const colors = [0xf291b4, 0x6fb7ea, 0xffd166, 0x8fd9b6, 0xb9a3e8];
  const R = 3.2;
  const balloons = [];
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI;
    const balloon = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 12, 10),
      new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.25 }),
    );
    balloon.scale.y = 1.18;
    balloon.position.set(Math.cos(a) * R, Math.sin(a) * R * 0.85 + 0.2, (i % 2) * 0.18);
    balloon.castShadow = true;
    balloon.userData.phase = i * 0.7;
    g.add(balloon);
    balloons.push(balloon);
  }
  g.userData.update = (t) => {
    for (const b of balloons) {
      b.position.y += Math.sin(t * 1.7 + b.userData.phase) * 0.0009;
      b.rotation.z = Math.sin(t * 1.3 + b.userData.phase) * 0.06;
    }
  };
  return g;
}
