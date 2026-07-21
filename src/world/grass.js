import * as THREE from 'three';
import { mulberry32 } from '../core/prng.js';
import { grassBladeTexture, flowerTuftTexture } from '../core/textures.js';

// Instanced wind-blown grass tufts (crossed cards) + sparse wildflowers.
// Chunked along the route; density falls off away from the road.

function tuftGeometry() {
  const geos = [];
  const w = 0.42, h = 0.34;
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(w, h, 1, 2);
    g.translate(0, h / 2, 0);
    g.rotateY((i / 3) * Math.PI);
    geos.push(g);
  }
  const merged = mergeGeos(geos);
  const pos = merged.getAttribute('position');
  const bend = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / h;
    bend[i] = t * t;
  }
  merged.setAttribute('aBend', new THREE.BufferAttribute(bend, 1));
  return merged;
}

function mergeGeos(geos) {
  // minimal merge (positions/normals/uvs + index)
  let vCount = 0, iCount = 0;
  for (const g of geos) { vCount += g.getAttribute('position').count; iCount += g.getIndex().count; }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx = new Uint16Array(iCount);
  let vo = 0, io = 0;
  for (const g of geos) {
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), u = g.getAttribute('uv'), ix = g.getIndex();
    pos.set(p.array, vo * 3); nor.set(n.array, vo * 3); uv.set(u.array, vo * 2);
    for (let i = 0; i < ix.count; i++) idx[io + i] = ix.array[i] + vo;
    vo += p.count; io += ix.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

function windify(material, timeU) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeU;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n uniform float uTime; attribute float aBend;`)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float phase = iPos.x * 1.7 + iPos.z * 2.3;
          float sway = sin(uTime * 1.6 + phase) + 0.45 * sin(uTime * 3.9 + phase * 1.31);
          float gust = 0.5 + 0.5 * sin(uTime * 0.53 + iPos.x * 0.05 + iPos.z * 0.041);
          transformed.x += sway * (0.045 + 0.075 * gust) * aBend;
          transformed.z += sway * 0.03 * gust * aBend;
        #endif
      `);
  };
  return material;
}

export class GrassField {
  constructor(route, terrain, timeU, { densityScale = 1 } = {}) {
    this.route = route;
    this.terrain = terrain;
    this.timeU = timeU;
    this.chunkLen = 60;
    this.chunks = new Map();
    this.group = new THREE.Group();
    this.group.name = 'grass';
    this.densityScale = densityScale;

    this.tuftGeo = tuftGeometry();
    const bladeTex = grassBladeTexture();
    // emissiveMap = blade map fakes backlit translucency: grass glows, never goes black
    this.tuftMat = windify(new THREE.MeshLambertMaterial({
      map: bladeTex,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0x5d6c33),
      emissiveMap: bladeTex,
      emissiveIntensity: 0.62,
    }), timeU);
    this.flowerMat = windify(new THREE.MeshLambertMaterial({
      map: flowerTuftTexture(),
      alphaTest: 0.4,
      side: THREE.DoubleSide,
    }), timeU);

    this.baseColor = new THREE.Color();
  }

  ensureRange(s0, s1) {
    const c0 = Math.max(0, Math.floor(s0 / this.chunkLen));
    const c1 = Math.min(Math.ceil(this.route.length / this.chunkLen) - 1, Math.floor(s1 / this.chunkLen));
    for (let ci = c0; ci <= c1; ci++) {
      if (!this.chunks.has(ci)) this.#buildChunk(ci);
    }
    for (const [ci, meshes] of this.chunks) {
      if (ci < c0 - 1 || ci > c1 + 1) {
        for (const m of meshes) { this.group.remove(m); m.dispose?.(); }
        this.chunks.delete(ci);
      }
    }
  }

  #buildChunk(ci) {
    const s0 = ci * this.chunkLen;
    const rand = mulberry32(9000 + ci * 131);
    const tuftCount = Math.floor(2100 * this.densityScale);
    const flowerCount = Math.floor(tuftCount * 0.045);
    const M = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const AXIS_Y = new THREE.Vector3(0, 1, 0);
    const S = new THREE.Vector3();
    const P = new THREE.Vector3();

    const place = (mesh, count, colorFn, scaleRange) => {
      let placed = 0, guard = 0;
      while (placed < count && guard < count * 6) {
        guard++;
        const s = s0 + rand() * this.chunkLen;
        // density falls off with |d|; band 3.5..30m
        const side = rand() < 0.5 ? -1 : 1;
        const u = rand();
        const ad = 3.5 + Math.pow(u, 1.7) * 27;
        const d = side * ad;
        if (this.skipAt && this.skipAt(s, d)) continue;
        const h = this.terrain.heightAt(s, d);
        if (h - this.route.yAt(s) < -3) continue; // deep dips / water
        this.route.lateral(s, d, h - 0.015, P);
        const sc = scaleRange[0] + rand() * (scaleRange[1] - scaleRange[0]);
        const nearRoadBoost = 1 + 0.15 * Math.max(0, 1 - (ad - 3.5) / 6);
        S.set(sc * (0.8 + rand() * 0.5), sc * nearRoadBoost, sc * (0.8 + rand() * 0.5));
        Q.setFromAxisAngle(AXIS_Y, rand() * Math.PI * 2);
        M.compose(P, Q, S);
        mesh.setMatrixAt(placed, M);
        mesh.setColorAt(placed, colorFn(rand, ad));
        placed++;
      }
      mesh.count = placed;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    };

    const tufts = new THREE.InstancedMesh(this.tuftGeo, this.tuftMat, tuftCount);
    tufts.receiveShadow = true;
    place(tufts, tuftCount, (r) => {
      const t = r();
      const c = this.baseColor.setHSL(
        0.23 + (r() - 0.5) * 0.04,
        0.42 + t * 0.18,
        0.6 + r() * 0.25,
      );
      if (r() < 0.14) c.setHSL(0.135, 0.48, 0.56); // dry golden tuft
      return c;
    }, [0.55, 1.05]);

    const flowers = new THREE.InstancedMesh(this.tuftGeo, this.flowerMat, flowerCount);
    place(flowers, flowerCount, (r) => this.baseColor.setHSL(0, 0, 0.85 + r() * 0.15), [0.7, 1.1]);

    tufts.frustumCulled = true; flowers.frustumCulled = true;
    tufts.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.group.add(tufts); this.group.add(flowers);
    this.chunks.set(ci, [tufts, flowers]);
  }
}
