import * as THREE from 'three';

// Rae: stylized toddler, jointed-group rig (no skinning — sphere joints hide
// seams). Built from the reference photos: black hair with ponytail + colorful
// clips, cream tee with terracotta wavy stripes, pale-yellow shorts, pink
// shoes, pink helmet for riding. ~0.82m tall, big-head toddler proportions.

// Rae: cream tee with terracotta wavy stripes. Zoe (cousin): sunshine-yellow
// tee with white polka dots, hair worn down with a fringe.
const VARIANTS = {
  rae: {
    skin: 0xf2c9a4, hair: 0x27221f,
    shorts: 0xf0dfa0, shoe: 0xed8fb4, helmet: 0xf29ec0,
    tieColor: 0xf5a8c4, ponytail: true, clips: true,
  },
  zoe: {
    skin: 0xefc4a0, hair: 0x2e2620,
    shorts: 0xb8bdc8, shoe: 0xee8f6a, helmet: 0xf2c035,
    tieColor: 0xf2c035, ponytail: false, clips: false,
  },
};

const SKIN_SHADE = 0xe6b892;

function teeTexture(variant) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  if (variant === 'zoe') {
    x.fillStyle = '#f7d84a';
    x.fillRect(0, 0, 256, 256);
    x.fillStyle = 'rgba(255,255,255,0.9)';
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        x.beginPath();
        x.arc(24 + col * 42 + (row % 2) * 21, 24 + row * 40, 7.5, 0, Math.PI * 2);
        x.fill();
      }
    }
  } else {
    x.fillStyle = '#f7ecdc';
    x.fillRect(0, 0, 256, 256);
    x.strokeStyle = '#c9834e';
    x.lineWidth = 13;
    for (let i = 0; i < 6; i++) {
      const y = 26 + i * 40;
      x.beginPath();
      for (let px = -4; px <= 260; px += 8) {
        const yy = y + Math.sin(px * 0.09 + i) * 5;
        if (px === -4) x.moveTo(px, yy); else x.lineTo(px, yy);
      }
      x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function faceTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  // transparent base — face features only, layered over skin sphere
  x.clearRect(0, 0, 512, 256);
  const cx = 256, ey = 108;
  // eyes: friendly dark ovals with glint
  for (const s of [-1, 1]) {
    const ex = cx + s * 40;
    x.fillStyle = '#2a2320';
    x.beginPath(); x.ellipse(ex, ey, 10.5, 14, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.85)';
    x.beginPath(); x.ellipse(ex - 3, ey - 4.5, 3.2, 4, 0, 0, Math.PI * 2); x.fill();
    // brow
    x.strokeStyle = 'rgba(52,40,34,0.75)'; x.lineWidth = 4.5;
    x.beginPath(); x.moveTo(ex - 13, ey - 26); x.quadraticCurveTo(ex, ey - 33, ex + 13, ey - 27); x.stroke();
    // blush
    x.fillStyle = 'rgba(240,140,150,0.4)';
    x.beginPath(); x.ellipse(ex + s * 18, ey + 34, 14, 8.5, 0, 0, Math.PI * 2); x.fill();
  }
  // smile
  x.strokeStyle = '#9c5f4e'; x.lineWidth = 5; x.lineCap = 'round';
  x.beginPath(); x.moveTo(cx - 16, ey + 44); x.quadraticCurveTo(cx, ey + 56, cx + 16, ey + 44); x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function capsule(r, len, mat, { seg = 12 } = {}) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, seg), mat);
  m.castShadow = true;
  return m;
}

export function buildRae({ variant = 'rae' } = {}) {
  const V = VARIANTS[variant] ?? VARIANTS.rae;
  const skinMat = new THREE.MeshStandardMaterial({ color: V.skin, roughness: 0.62 });
  const skinDark = new THREE.MeshStandardMaterial({ color: SKIN_SHADE, roughness: 0.62 });
  const hairMat = new THREE.MeshStandardMaterial({ color: V.hair, roughness: 0.72 });
  const teeMat = new THREE.MeshStandardMaterial({ map: teeTexture(variant), roughness: 0.85 });
  const shortsMat = new THREE.MeshStandardMaterial({ color: V.shorts, roughness: 0.9 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: V.shoe, roughness: 0.55 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: V.helmet, roughness: 0.42 });

  const root = new THREE.Group(); // at hip center
  root.name = 'rae';

  // pelvis / shorts
  const pelvis = capsule(0.075, 0.05, shortsMat);
  pelvis.scale.set(1.05, 0.8, 0.9);
  pelvis.position.y = 0.0;
  root.add(pelvis);

  // spine → torso → neck → head
  const spine = new THREE.Group();
  spine.position.set(0, 0.045, 0);
  root.add(spine);
  const torso = capsule(0.088, 0.13, teeMat);
  torso.position.y = 0.075;
  torso.scale.set(1, 1, 0.88);
  spine.add(torso);
  // little sleeve caps
  for (const s of [-1, 1]) {
    const sleeve = capsule(0.042, 0.035, teeMat);
    sleeve.position.set(s * 0.1, 0.135, 0.005);
    sleeve.rotation.z = s * 1.15;
    spine.add(sleeve);
  }

  const neck = new THREE.Group();
  neck.position.set(0, 0.185, 0.008);
  spine.add(neck);
  const neckMesh = capsule(0.032, 0.03, skinMat);
  neckMesh.position.y = 0.0;
  neck.add(neckMesh);

  const headGrp = new THREE.Group();
  headGrp.position.set(0, 0.065, 0.004);
  neck.add(headGrp);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 18), skinMat);
  head.scale.set(0.96, 1.02, 0.94);
  head.castShadow = true;
  headGrp.add(head);
  // face features on a slightly larger transparent shell so they float over skin
  const faceShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.1065, 24, 18),
    new THREE.MeshStandardMaterial({ map: faceTexture(), transparent: true, roughness: 0.6 }),
  );
  faceShell.scale.copy(head.scale);
  faceShell.rotation.y = Math.PI; // face texture centered at +Z
  headGrp.add(faceShell);
  // ears
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), skinDark);
    ear.position.set(s * 0.098, -0.005, -0.01);
    headGrp.add(ear);
  }
  // nose dot
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), skinDark);
  nose.position.set(0, -0.012, 0.1);
  headGrp.add(nose);

  // hair: back cap + bangs + ponytail
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.112, 20, 16), hairMat);
  hairCap.scale.set(1.0, 1.02, 0.92);
  hairCap.position.set(0, 0.012, -0.028);
  hairCap.castShadow = true;
  headGrp.add(hairCap);
  const bangs = new THREE.Group();
  for (let i = -2; i <= 2; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.033, 10, 8), hairMat);
    b.position.set(i * 0.032, 0.085 - Math.abs(i) * 0.012, 0.062 - Math.abs(i) * 0.012);
    b.scale.set(1, 0.8, 0.75);
    bangs.add(b);
  }
  headGrp.add(bangs);
  // hair clips (Rae only: little colorful snaps in the fringe)
  if (V.clips) {
    const clipColors = [0x59c1e8, 0xffd166, 0xf291b4];
    clipColors.forEach((col, i) => {
      const clip = new THREE.Mesh(
        new THREE.BoxGeometry(0.026, 0.007, 0.01),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.3 }),
      );
      clip.position.set(0.052 + i * 0.014, 0.062 - i * 0.02, 0.075);
      clip.rotation.z = -0.5 - i * 0.15;
      headGrp.add(clip);
    });
  }

  // ponytail chain (Rae) — Zoe wears her hair down in a soft bob
  const pony0 = new THREE.Group();
  pony0.position.set(0, 0.015, -0.1);
  headGrp.add(pony0);
  const pony1 = new THREE.Group();
  pony1.position.set(0, -0.07, -0.02);
  pony0.add(pony1);
  if (V.ponytail) {
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.009, 8, 12), new THREE.MeshStandardMaterial({ color: V.tieColor, roughness: 0.5 }));
    tie.rotation.x = Math.PI / 2 - 0.5;
    pony0.add(tie);
    const seg1 = capsule(0.03, 0.05, hairMat);
    seg1.position.set(0, -0.035, -0.012);
    pony0.add(seg1);
    const seg2 = capsule(0.023, 0.045, hairMat);
    seg2.position.set(0, -0.033, 0);
    pony1.add(seg2);
  } else {
    for (const s of [-1, 1]) {
      const tuft = capsule(0.034, 0.05, hairMat);
      tuft.position.set(s * 0.092, -0.026, 0.012);
      tuft.scale.set(0.85, 1, 0.9);
      headGrp.add(tuft);
    }
    const back = capsule(0.062, 0.05, hairMat);
    back.position.set(0, -0.02, -0.062);
    back.scale.set(1.35, 1, 0.85);
    headGrp.add(back);
  }

  // helmet (worn while riding)
  const helmet = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.125, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), helmetMat);
  shell.scale.set(1, 0.92, 1.06);
  shell.position.y = 0.012;
  shell.castShadow = true;
  helmet.add(shell);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.121, 0.011, 8, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.016;
  rim.scale.set(1, 1.06, 1);
  helmet.add(rim);
  // daisy sticker
  for (let p = 0; p < 6; p++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    const a = (p / 6) * Math.PI * 2;
    petal.position.set(0.055 + Math.cos(a) * 0.014, 0.075 + Math.sin(a) * 0.014, 0.088);
    petal.scale.z = 0.4;
    helmet.add(petal);
  }
  const daisyCore = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 5), new THREE.MeshStandardMaterial({ color: 0xffd166 }));
  daisyCore.position.set(0.055, 0.075, 0.092);
  daisyCore.scale.z = 0.4;
  helmet.add(daisyCore);
  // straps
  for (const s of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0xe58cab, roughness: 0.6 }));
    strap.position.set(s * 0.085, -0.045, 0.02);
    strap.rotation.z = s * 0.28;
    strap.rotation.x = 0.15;
    helmet.add(strap);
  }
  helmet.position.set(0, 0.028, -0.006);
  headGrp.add(helmet);

  // arms
  const arms = {};
  for (const s of [-1, 1]) {
    const key = s === -1 ? 'L' : 'R';
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.105, 0.155, 0.008);
    spine.add(shoulder);
    const upper = capsule(0.033, 0.105, skinMat);
    upper.position.y = -0.07;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.148, 0);
    shoulder.add(elbow);
    const fore = capsule(0.028, 0.1, skinMat);
    fore.position.y = -0.065;
    elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.031, 10, 8), skinMat);
    hand.position.set(0, -0.142, 0);
    hand.castShadow = true;
    elbow.add(hand);
    arms[key] = { shoulder, elbow, upperLen: 0.148, foreLen: 0.142 };
  }

  // legs
  const legs = {};
  for (const s of [-1, 1]) {
    const key = s === -1 ? 'L' : 'R';
    const hip = new THREE.Group();
    hip.position.set(s * 0.054, -0.02, 0);
    root.add(hip);
    // shorts leg over the thigh top
    const shortLeg = capsule(0.048, 0.04, shortsMat);
    shortLeg.position.y = -0.035;
    hip.add(shortLeg);
    const thigh = capsule(0.041, 0.09, skinMat);
    thigh.position.y = -0.085;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.set(0, -0.16, 0);
    hip.add(knee);
    const shin = capsule(0.034, 0.095, skinMat);
    shin.position.y = -0.07;
    knee.add(shin);
    const ankle = new THREE.Group();
    ankle.position.set(0, -0.155, 0);
    knee.add(ankle);
    const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.05, 4, 10), shoeMat);
    shoe.rotation.x = Math.PI / 2;
    shoe.position.set(0, -0.012, 0.022);
    shoe.scale.set(0.95, 1, 0.82);
    shoe.castShadow = true;
    ankle.add(shoe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.012, 0.105), new THREE.MeshStandardMaterial({ color: 0xf7f4ef, roughness: 0.8 }));
    sole.position.set(0, -0.042, 0.02);
    ankle.add(sole);
    legs[key] = { hip, knee, ankle, thighLen: 0.16, shinLen: 0.155 };
  }

  return {
    root, spine, neck, headGrp, helmet, pony0, pony1, arms, legs,
    heights: { hipToHeadTop: 0.46 },
    setHelmet(on) { helmet.visible = on; },
  };
}
