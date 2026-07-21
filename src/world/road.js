import * as THREE from 'three';
import { GLSL_NOISE } from '../core/prng.js';
import { asphaltTextures, concreteTexture } from '../core/textures.js';

// Spline-extruded carriageway with shader-drawn markings (edge lines, centre
// dashes, zebra crossings, PCN red surface) plus concrete kerbs both sides.

const ASPHALT_PROFILE = [
  // [d, dy]
  [-2.72, -0.02], [-2.55, 0], [-1.6, 0.022], [0, 0.045], [1.6, 0.022], [2.55, 0], [2.72, -0.02],
];
const KERB_PROFILE = [
  [2.72, -0.02], [2.78, 0.095], [3.35, 0.105],
];

export class Road {
  constructor(route, { zebras = [], pcn = [0, 0] } = {}) {
    this.route = route;
    this.group = new THREE.Group();
    this.group.name = 'road';

    const { albedo, normal } = asphaltTextures();
    this.asphaltMat = new THREE.MeshStandardMaterial({
      map: albedo,
      normalMap: normal,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.94,
      metalness: 0.0,
    });
    const zebraArr = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < Math.min(3, zebras.length); i++) {
      zebraArr[i * 2] = zebras[i]; zebraArr[i * 2 + 1] = 1;
    }
    this.asphaltMat.onBeforeCompile = (shader) => {
      shader.uniforms.uZebra = { value: zebraArr };
      shader.uniforms.uPcn = { value: new THREE.Vector2(pcn[0], pcn[1]) };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n attribute float aS; attribute float aD; varying float vS; varying float vD;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vS = aS; vD = aD;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n varying float vS; varying float vD; uniform float uZebra[6]; uniform vec2 uPcn;\n ${GLSL_NOISE}`)
        .replace('#include <map_fragment>', `
          #include <map_fragment>
          float worn = 0.62 + 0.38 * rbNoise(vec2(vS * 0.6, vD * 1.7));
          float zebra = 0.0;
          for (int i = 0; i < 3; i++) {
            if (uZebra[i * 2 + 1] > 0.5) {
              float zd = abs(vS - uZebra[i * 2]);
              if (zd < 1.85) {
                float bar = step(fract((vD + 2.72) / 0.92), 0.58);
                zebra = max(zebra, bar * smoothstep(1.85, 1.65, zd));
              }
            }
          }
          float edge = (step(2.26, abs(vD)) - step(2.44, abs(vD)));
          float dash = (1.0 - step(0.078, abs(vD))) * step(fract(vS / 7.5), 0.4) * (1.0 - step(0.001, zebra));
          float pcnZone = step(uPcn.x, vS) * step(vS, uPcn.y) * step(abs(vD), 2.44);
          vec3 markCol = vec3(0.92, 0.92, 0.86);
          float mark = max(max(edge, dash), zebra);
          // PCN: brick-red riding surface, markings stay visible
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.408, 0.172, 0.15) * (0.82 + 0.4 * rbNoise(vec2(vS * 0.9, vD * 2.3))), pcnZone * 0.88);
          diffuseColor.rgb = mix(diffuseColor.rgb, markCol, mark * worn * 0.9);
        `);
    };

    this.kerbMat = new THREE.MeshStandardMaterial({
      map: concreteTexture([198, 194, 186]),
      roughness: 0.95,
    });

    this.#buildChunks();
  }

  #buildChunks() {
    const L = this.route.length;
    const chunkLen = 300;
    const n = Math.ceil(L / chunkLen);
    for (let i = 0; i < n; i++) {
      const s0 = i * chunkLen;
      const s1 = Math.min(L, s0 + chunkLen);
      this.group.add(this.#ribbon(s0, s1, ASPHALT_PROFILE, this.asphaltMat, true));
      this.group.add(this.#ribbon(s0, s1, KERB_PROFILE, this.kerbMat, false));
      this.group.add(this.#ribbon(s0, s1, KERB_PROFILE.map(([d, y]) => [-d, y]).reverse(), this.kerbMat, false));
    }
  }

  #ribbon(s0, s1, profile, material, withSD) {
    const step = 1.6;
    const rows = Math.max(2, Math.ceil((s1 - s0) / step));
    const cols = profile.length;
    const count = (rows + 1) * cols;
    const positions = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    const aS = withSD ? new Float32Array(count) : null;
    const aD = withSD ? new Float32Array(count) : null;
    const indices = [];
    const P = new THREE.Vector3();

    let v = 0;
    for (let r = 0; r <= rows; r++) {
      const s = s0 + (r / rows) * (s1 - s0);
      const y = this.route.yAt(s);
      for (let c = 0; c < cols; c++) {
        const [d, dy] = profile[c];
        this.route.lateral(s, d, y + dy, P);
        positions[v * 3] = P.x; positions[v * 3 + 1] = P.y; positions[v * 3 + 2] = P.z;
        uvs[v * 2] = d * 0.5; uvs[v * 2 + 1] = s * 0.5;
        if (withSD) { aS[v] = s; aD[v] = d; }
        v++;
      }
      if (r < rows) {
        for (let c = 0; c < cols - 1; c++) {
          const a = r * cols + c, b = a + 1, cc = a + cols, dd = cc + 1;
          indices.push(a, b, cc, b, dd, cc);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    if (withSD) {
      geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
      geo.setAttribute('aD', new THREE.BufferAttribute(aD, 1));
    }
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    geo.computeBoundingSphere();
    return mesh;
  }
}
