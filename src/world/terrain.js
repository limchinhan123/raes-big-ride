import * as THREE from 'three';
import { fbm2, GLSL_NOISE } from '../core/prng.js';
import { groundGrassTexture, dirtTexture, sandTexture } from '../core/textures.js';

// Chunked heightfield hugging the road. Two strips per chunk (left/right of
// the carriageway) so no polygons fight the road surface. Heights come from
// one continuous h(s,d) function -> analytic-ish normals, seam-free chunks.

const KERB_TOP = 3.35;   // terrain starts here, matching the kerb edge
const LAT = [150, 118, 92, 71, 54, 40, 29.5, 21.5, 15.5, 11, 7.8, 5.5, 4.3, KERB_TOP];

export class Terrain {
  constructor(route, { shape = null, materialMask = null } = {}) {
    this.route = route;
    this.shape = shape;               // (s, d, h) => h  chapter override hook
    this.materialMask = materialMask; // (s, d) => 0 grass | 1 sand | 2 dirt
    this.chunkLen = 90;
    this.chunks = new Map();
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    this.timeU = { value: 0 };

    const grass = groundGrassTexture();
    const dirt = dirtTexture();
    const sand = sandTexture();
    grass.repeat.set(1, 1);

    // Lambert: zero grazing-angle specular sheen — flat matte ground like the reference
    this.material = new THREE.MeshLambertMaterial({
      map: grass,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uDirt = { value: dirt };
      shader.uniforms.uSand = { value: sand };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n varying vec3 vWorld; varying float vMat; attribute float aMat;`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n vWorld = (modelMatrix * vec4(position,1.0)).xyz; vMat = aMat;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n varying vec3 vWorld; varying float vMat; uniform sampler2D uDirt; uniform sampler2D uSand;\n ${GLSL_NOISE}`)
        .replace('#include <map_fragment>', `
          vec2 wuv = vWorld.xz;
          vec4 gCol = texture2D(map, wuv / 3.1);
          vec4 dCol = texture2D(uDirt, wuv / 3.2);
          vec4 sCol = texture2D(uSand, wuv / 3.8);
          // macro variation breaks tiling
          float macro = rbFbm(wuv * 0.021);
          gCol.rgb *= 0.68 + 0.62 * macro;
          // dry patches
          float dry = smoothstep(0.62, 0.78, rbFbm(wuv * 0.05 + 31.0));
          gCol.rgb = mix(gCol.rgb, vec3(0.62, 0.58, 0.34) * (0.8 + 0.3 * macro), dry * 0.55);
          float sandy = smoothstep(0.5, 0.95, vMat) * step(vMat, 1.5);
          float dirty = smoothstep(1.5, 1.95, vMat);
          vec4 blended = mix(mix(gCol, sCol, sandy), dCol, dirty);
          diffuseColor *= blended;
        `);
      this.material.userData.shader = shader;
    };
    // aMat drives grass->sand->dirt; declared via geometry attribute
  }

  // The one true ground height function.
  heightAt(s, d) {
    const r = this.route;
    const roadY = r.yAt(s);
    const ad = Math.abs(d);
    // shoulder: kerb-top height, gentle grass rise, worn strip
    let h = roadY + 0.10;
    const p = r.lateral(s, d);
    const hills =
      (fbm2(p.x * 0.0052, p.z * 0.0052, 4, 800) - 0.5) * 2 * 6.5 +
      (fbm2(p.x * 0.021, p.z * 0.021, 3, 801) - 0.5) * 2 * 1.1;
    const ramp = THREE.MathUtils.smoothstep(ad, 9, 34);
    // near the road the verge may only dip slightly; big dips allowed far out
    const dipFloor = -0.45 - THREE.MathUtils.smoothstep(ad, 12, 70) * 7.5;
    h += Math.max(hills * ramp, dipFloor);
    // slight verge undulation close-in
    h += (fbm2(s * 0.06, d * 0.21, 2, 802) - 0.5) * 0.18 * THREE.MathUtils.smoothstep(ad, 3.4, 7);
    if (this.shape) h = this.shape(s, d, h, roadY);
    return h;
  }

  materialAt(s, d) {
    if (this.materialMask) return this.materialMask(s, d);
    // default: worn dirt strip just off the kerb, occasional bare patches
    const ad = Math.abs(d);
    if (ad > 3.4 && ad < 4.7 && fbm2(s * 0.05, d, 2, 803) > 0.46) return 2 * Math.min(1, (4.7 - ad));
    return 0;
  }

  ensureRange(s0, s1) {
    const c0 = Math.max(0, Math.floor(s0 / this.chunkLen));
    const c1 = Math.min(Math.ceil(this.route.length / this.chunkLen) - 1, Math.floor(s1 / this.chunkLen));
    for (let ci = c0; ci <= c1; ci++) {
      if (!this.chunks.has(ci)) this.#buildChunk(ci);
    }
    for (const [ci, mesh] of this.chunks) {
      if (ci < c0 - 1 || ci > c1 + 1) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        this.chunks.delete(ci);
      }
    }
  }

  #buildChunk(ci) {
    const s0 = ci * this.chunkLen;
    const rows = 30;
    const ds = this.chunkLen / rows;
    const cols = LAT.length;
    const vertsPerStrip = (rows + 1) * cols;
    const positions = new Float32Array(vertsPerStrip * 2 * 3);
    const normals = new Float32Array(vertsPerStrip * 2 * 3);
    const mats = new Float32Array(vertsPerStrip * 2);
    const indices = [];
    const P = new THREE.Vector3();

    let v = 0;
    for (const side of [-1, 1]) {
      const stripBase = v / 3;
      for (let rI = 0; rI <= rows; rI++) {
        const s = s0 + rI * ds;
        for (let cI = 0; cI < cols; cI++) {
          const d = side * LAT[side === -1 ? cI : cols - 1 - cI];
          const dd = side === -1 ? LAT[cI] * side : LAT[cols - 1 - cI] * side;
          const h = this.heightAt(s, dd);
          this.route.lateral(s, dd, h, P);
          positions[v] = P.x; positions[v + 1] = P.y; positions[v + 2] = P.z;
          // numeric normal from h(s,d) surface
          const e = 1.4;
          const hs1 = this.heightAt(s + e, dd), hs0 = this.heightAt(s - e, dd);
          const hd1 = this.heightAt(s, dd + e), hd0 = this.heightAt(s, dd - e);
          const dir = this.route.dirAt(s);
          const right = this.route.rightAt(s);
          const dpds = new THREE.Vector3(dir.x * 2 * e, hs1 - hs0, dir.z * 2 * e);
          const dpdd = new THREE.Vector3(right.x * 2 * e, hd1 - hd0, right.z * 2 * e);
          const n = dpdd.cross(dpds).normalize();
          if (n.y < 0) n.negate();
          normals[v] = n.x; normals[v + 1] = n.y; normals[v + 2] = n.z;
          mats[v / 3] = this.materialAt(s, dd);
          v += 3;
        }
      }
      for (let rI = 0; rI < rows; rI++) {
        for (let cI = 0; cI < cols - 1; cI++) {
          const a = stripBase + rI * cols + cI;
          const b = a + 1;
          const c2 = a + cols;
          const d2 = c2 + 1;
          indices.push(a, b, c2, b, d2, c2);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('aMat', new THREE.BufferAttribute(mats, 1));
    // uv unused (world-space uv in shader) but standard material wants it
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vertsPerStrip * 2 * 2), 2));
    geo.setIndex(indices);
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    geo.computeBoundingSphere();
    this.chunks.set(ci, mesh);
    this.group.add(mesh);
  }
}
