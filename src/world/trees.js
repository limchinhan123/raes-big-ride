import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/prng.js';
import { barkTextures, leafClusterTexture, frondTexture } from '../core/textures.js';

// Procedural trees: rain trees (umbrella canopies of leaf-cluster cards),
// coconut palms, and shrubs. Per placement-batch, everything merges into two
// draw calls (bark + foliage).

let _mats = null;
export function treeMaterials(timeU) {
  if (_mats) return _mats;
  const bark = barkTextures();
  const barkMat = new THREE.MeshStandardMaterial({
    map: bark.albedo, normalMap: bark.normal, roughness: 1.0,
  });
  const leafTex = leafClusterTexture();
  const leafMat = new THREE.MeshLambertMaterial({
    map: leafTex, alphaTest: 0.38, side: THREE.DoubleSide,
    vertexColors: true,
    emissive: new THREE.Color(0x36512a),
    emissiveMap: leafTex,
    emissiveIntensity: 0.42,
  });
  const frondTex = frondTexture();
  const frondMat = new THREE.MeshLambertMaterial({
    map: frondTex, alphaTest: 0.35, side: THREE.DoubleSide,
    vertexColors: true,
    emissive: new THREE.Color(0x44602c),
    emissiveMap: frondTex,
    emissiveIntensity: 0.55,
  });
  const sway = (mat, amp) => {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeU;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n uniform float uTime; attribute float aPhase; attribute float aAmp;')
        .replace('#include <begin_vertex>', `
          #include <begin_vertex>
          float sw = sin(uTime * 0.9 + aPhase) + 0.5 * sin(uTime * 2.17 + aPhase * 1.7);
          transformed.x += sw * aAmp * ${amp};
          transformed.z += sw * aAmp * ${amp * 0.6};
        `);
    };
  };
  sway(leafMat, 0.06);
  sway(frondMat, 0.09);
  _mats = { barkMat, leafMat, frondMat };
  return _mats;
}

function tube(points, r0, r1, radialSegs = 6) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, Math.max(4, points.length * 3), r0, radialSegs, false);
  // taper: scale radius along length by shrinking verts toward the spine
  const pos = geo.getAttribute('position');
  const segs = geo.parameters.tubularSegments;
  const radial = geo.parameters.radialSegments;
  const spine = [];
  for (let i = 0; i <= segs; i++) spine.push(curve.getPointAt(i / segs));
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const r = THREE.MathUtils.lerp(r0, r1, t) / r0;
    const c = spine[i];
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      pos.setXYZ(idx,
        c.x + (pos.getX(idx) - c.x) * r,
        c.y + (pos.getY(idx) - c.y) * r,
        c.z + (pos.getZ(idx) - c.z) * r,
      );
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function card(w, h) {
  const g = new THREE.PlaneGeometry(w, h, 1, 1);
  return g;
}

function paintVerts(geo, color) {
  const n = geo.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = color.r; arr[i * 3 + 1] = color.g; arr[i * 3 + 2] = color.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function tagSway(geo, phase, amp) {
  const n = geo.getAttribute('position').count;
  const ph = new Float32Array(n).fill(phase);
  const am = new Float32Array(n).fill(amp);
  geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  geo.setAttribute('aAmp', new THREE.BufferAttribute(am, 1));
  return geo;
}

const C = new THREE.Color();

export function buildRainTree(seed, scale = 1) {
  const rand = mulberry32(seed);
  const barkGeos = [], leafGeos = [];
  const leanA = rand() * Math.PI * 2;
  const lean = 0.5 + rand() * 0.9;
  const H = (3.3 + rand() * 1.1) * scale;
  const lx = Math.cos(leanA) * lean, lz = Math.sin(leanA) * lean;

  const trunkPts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lx * 0.3, H * 0.36, lz * 0.3),
    new THREE.Vector3(lx * 0.7, H * 0.72, lz * 0.7),
    new THREE.Vector3(lx, H, lz),
  ];
  barkGeos.push(tube(trunkPts, 0.34 * scale, 0.17 * scale, 7));

  const top = trunkPts[3];
  const branches = 6 + Math.floor(rand() * 2);
  for (let i = 0; i < branches; i++) {
    const a = (i / branches) * Math.PI * 2 + rand() * 0.8;
    const r = (2.8 + rand() * 2.0) * scale;
    const tip = new THREE.Vector3(
      top.x + Math.cos(a) * r,
      top.y + (0.9 + rand() * 1.1) * scale,
      top.z + Math.sin(a) * r,
    );
    const mid = top.clone().lerp(tip, 0.5); mid.y += 0.35 * scale;
    barkGeos.push(tube([top.clone(), mid, tip], 0.11 * scale, 0.035 * scale, 5));
  }

  // canopy: wide flattened umbrella of leaf cards above branch tips
  const center = new THREE.Vector3(top.x + lx * 0.25, top.y + 1.3 * scale, top.z + lz * 0.25);
  const R = (5.4 + rand() * 1.8) * scale;
  const squash = 0.34;
  const cards = Math.floor(185 * scale);
  const dir = new THREE.Vector3();
  const phase = rand() * 10;
  for (let i = 0; i < cards; i++) {
    // cosine-weighted upward hemisphere
    const u = rand(), v2 = rand();
    const th = Math.acos(Math.sqrt(1 - u * 0.92));
    const ph2 = v2 * Math.PI * 2;
    dir.set(Math.sin(th) * Math.cos(ph2), Math.cos(th), Math.sin(th) * Math.sin(ph2));
    const rr = R * (0.68 + rand() * 0.32);
    const p = new THREE.Vector3(dir.x * rr, dir.y * rr * squash, dir.z * rr).add(center);
    const size = (1.7 + rand() * 1.1) * scale;
    const g = card(size, size * 0.8);
    // vertex color is a light tint on top of the leaf texture, not a paint
    const light = THREE.MathUtils.clamp(0.62 + dir.y * 0.5 + (rand() - 0.5) * 0.2, 0.4, 1.2);
    C.setHSL(0.25 + (rand() - 0.5) * 0.02, 0.3, 0.55 * light);
    paintVerts(g, C);
    tagSway(g, phase + i * 0.13, 0.5 + dir.y * 0.6);
    const m = new THREE.Matrix4().lookAt(p, center, new THREE.Vector3(0, 1, 0));
    const rot = new THREE.Matrix4().makeRotationZ(rand() * Math.PI * 2);
    m.multiply(rot);
    m.setPosition(p);
    g.applyMatrix4(m);
    leafGeos.push(g);
  }
  // inner dark fill
  for (let i = 0; i < 22; i++) {
    const p = new THREE.Vector3(
      center.x + (rand() - 0.5) * R * 0.9,
      center.y + (rand() - 0.3) * R * squash * 0.8,
      center.z + (rand() - 0.5) * R * 0.9,
    );
    const g = card(2.1 * scale, 1.7 * scale);
    C.setHSL(0.27, 0.3, 0.2 + rand() * 0.08);
    paintVerts(g, C);
    tagSway(g, phase + i, 0.3);
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3));
    m.setPosition(p);
    g.applyMatrix4(m);
    leafGeos.push(g);
  }
  return { bark: mergeGeometries(barkGeos), leaves: mergeGeometries(leafGeos) };
}

export function buildPalm(seed, scale = 1) {
  const rand = mulberry32(seed);
  const barkGeos = [], leafGeos = [];
  const leanA = rand() * Math.PI * 2;
  const lean = 0.9 + rand() * 1.1;
  const H = (4.6 + rand() * 1.6) * scale;
  const lx = Math.cos(leanA) * lean, lz = Math.sin(leanA) * lean;
  const pts = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    pts.push(new THREE.Vector3(lx * t * t, H * t, lz * t * t));
  }
  barkGeos.push(tube(pts, 0.17 * scale, 0.11 * scale, 6));
  const top = pts[4];
  const fronds = 10 + Math.floor(rand() * 3);
  const phase = rand() * 10;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + rand() * 0.4;
    const tilt = 0.35 + rand() * 0.75; // 0 = horizontal
    const len = (2.4 + rand() * 0.8) * scale;
    const g = card(0.85 * scale, len);
    // curve the frond: bend verts along its length
    const pos = g.getAttribute('position');
    for (let vi = 0; vi < pos.count; vi++) {
      const y = pos.getY(vi) + len / 2; // 0..len from base
      const droop = (y / len) * (y / len) * 0.9 * scale;
      pos.setZ(vi, pos.getZ(vi) - droop);
    }
    g.computeVertexNormals();
    const light = 0.72 + rand() * 0.45;
    C.setHSL(0.26 + (rand() - 0.5) * 0.02, 0.3, 0.5 * light);
    paintVerts(g, C);
    tagSway(g, phase + i * 0.4, 1.0);
    const m = new THREE.Matrix4();
    const e = new THREE.Euler(-Math.PI / 2 + tilt, a, 0, 'YXZ');
    m.makeRotationFromEuler(e);
    // move so base of card sits at trunk top
    const off = new THREE.Vector3(0, len / 2, 0).applyEuler(e);
    m.setPosition(top.x + off.x, top.y + off.y, top.z + off.z);
    g.applyMatrix4(m);
    leafGeos.push(g);
  }
  // coconuts
  for (let i = 0; i < 3; i++) {
    const g = new THREE.SphereGeometry(0.13 * scale, 6, 5);
    g.translate(top.x + (rand() - 0.5) * 0.4, top.y - 0.15, top.z + (rand() - 0.5) * 0.4);
    barkGeos.push(g);
  }
  return { bark: mergeGeometries(barkGeos), leaves: mergeGeometries(leafGeos) };
}

export function buildShrub(seed, scale = 1, flowering = false) {
  const rand = mulberry32(seed);
  const leafGeos = [];
  const rx = (0.9 + rand() * 0.5) * scale, ry = (0.65 + rand() * 0.35) * scale;
  const cards = 15;
  const phase = rand() * 10;
  for (let i = 0; i < cards; i++) {
    const a = rand() * Math.PI * 2, b = rand() * Math.PI;
    const p = new THREE.Vector3(
      Math.cos(a) * Math.sin(b) * rx,
      Math.abs(Math.cos(b)) * ry + 0.1,
      Math.sin(a) * Math.sin(b) * rx,
    );
    const g = card(0.75 * scale, 0.6 * scale);
    const light = 0.55 + (p.y / ry) * 0.45 + rand() * 0.2;
    if (flowering && rand() < 0.4) C.setHSL(0.9, 0.55, 0.6 + rand() * 0.15);
    else C.setHSL(0.28 + (rand() - 0.5) * 0.04, 0.3, 0.5 * light);
    paintVerts(g, C);
    tagSway(g, phase + i * 0.3, 0.35);
    const m = new THREE.Matrix4().lookAt(p, new THREE.Vector3(0, ry * 0.3, 0), new THREE.Vector3(0, 1, 0));
    m.multiply(new THREE.Matrix4().makeRotationZ(rand() * Math.PI));
    m.setPosition(p);
    g.applyMatrix4(m);
    leafGeos.push(g);
  }
  return { bark: null, leaves: mergeGeometries(leafGeos) };
}

// Merge a list of placed trees into 2-3 meshes.
export function plantBatch(placements, timeU) {
  const { barkMat, leafMat, frondMat } = treeMaterials(timeU);
  const barks = [], leaves = [], fronds = [];
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const AXIS = new THREE.Vector3(0, 1, 0);
  for (const pl of placements) {
    let built;
    if (pl.type === 'rain') built = buildRainTree(pl.seed, pl.scale ?? 1);
    else if (pl.type === 'palm') built = buildPalm(pl.seed, pl.scale ?? 1);
    else built = buildShrub(pl.seed, pl.scale ?? 1, pl.flowering);
    Q.setFromAxisAngle(AXIS, pl.rotY ?? 0);
    M.compose(pl.pos, Q, new THREE.Vector3(1, 1, 1));
    if (built.bark) { built.bark.applyMatrix4(M); barks.push(built.bark); }
    if (built.leaves) {
      built.leaves.applyMatrix4(M);
      (pl.type === 'palm' ? fronds : leaves).push(built.leaves);
    }
  }
  const group = new THREE.Group();
  if (barks.length) {
    const m = new THREE.Mesh(mergeGeometries(barks), barkMat);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  if (leaves.length) {
    const m = new THREE.Mesh(mergeGeometries(leaves), leafMat);
    m.castShadow = true;
    group.add(m);
  }
  if (fronds.length) {
    const m = new THREE.Mesh(mergeGeometries(fronds), frondMat);
    m.castShadow = true;
    group.add(m);
  }
  return group;
}
