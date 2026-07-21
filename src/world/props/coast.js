import * as THREE from 'three';
import { mulberry32, GLSL_NOISE } from '../../core/prng.js';

// East Coast kit: animated sea, breakwater rocks, horizon ships, kites,
// beach shelter. The sea is a big plane with a gentle Gerstner-ish shader.

export function buildSea(timeU) {
  const uniforms = {
    uTime: timeU,
    uDeep: { value: new THREE.Color(0x2e6f8e) },
    uShallow: { value: new THREE.Color(0x6fb5c9) },
    uSky: { value: new THREE.Color(0xcfe3ee) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(0xfff2d0) },
    // ShaderMaterial with fog:true must declare the fog uniforms itself
    fogColor: { value: new THREE.Color(0xd6e0e6) },
    fogDensity: { value: 0.0022 },
    fogNear: { value: 1 },
    fogFar: { value: 2000 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      varying vec3 vPos;
      varying vec3 vNorm;
      void main() {
        vec3 p = position;
        float w1 = sin(p.x * 0.11 + uTime * 0.9) * 0.14;
        float w2 = sin((p.x + p.y) * 0.061 + uTime * 0.63) * 0.2;
        float w3 = sin(p.y * 0.17 - uTime * 1.2) * 0.08;
        p.z += w1 + w2 + w3;
        float dx = 0.11 * cos(p.x * 0.11 + uTime * 0.9) * 0.14 + 0.061 * cos((p.x + p.y) * 0.061 + uTime * 0.63) * 0.2;
        float dy = 0.061 * cos((p.x + p.y) * 0.061 + uTime * 0.63) * 0.2 + 0.17 * cos(p.y * 0.17 - uTime * 1.2) * 0.08;
        vNorm = normalize(vec3(-dx, -dy, 1.0));
        vPos = p;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      ${GLSL_NOISE}
      uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky;
      uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uTime;
      varying vec3 vPos; varying vec3 vNorm;
      void main() {
        vec3 n = normalize(vNorm);
        // plane is rotated flat: local +z is world up, +y points at the beach
        float shore = smoothstep(20.0, 138.0, vPos.y);
        vec3 col = mix(uDeep, uShallow, shore * 0.85);
        // sky tint by fresnel-ish
        float fres = pow(1.0 - abs(n.z), 1.6);
        col = mix(col, uSky, fres * 0.55);
        // sparkle
        float sp = rbNoise(vPos.xy * 2.4 + uTime * 0.7) * rbNoise(vPos.xy * 5.1 - uTime * 0.9);
        float glint = smoothstep(0.52, 0.72, sp) * max(0.0, uSunDir.y) * 1.4;
        col += uSunColor * glint;
        // foam near shore
        float foam = smoothstep(130.0, 143.0, vPos.y + sin(vPos.x * 0.24 + uTime * 1.1) * 2.2);
        col = mix(col, vec3(0.93, 0.96, 0.96), foam * 0.75);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
  });
  const geo = new THREE.PlaneGeometry(560, 320, 80, 48);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  return { mesh, uniforms };
}

export function buildRock(seed, scale = 1) {
  const rand = mulberry32(seed);
  const geo = new THREE.IcosahedronGeometry(0.8 * scale, 1);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i,
      pos.getX(i) * (0.8 + rand() * 0.5),
      pos.getY(i) * (0.55 + rand() * 0.3),
      pos.getZ(i) * (0.8 + rand() * 0.5),
    );
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8b8a86, roughness: 0.95 }));
  mesh.castShadow = true;
  return mesh;
}

export function buildShip(seed = 1) {
  const rand = mulberry32(seed);
  const g = new THREE.Group();
  const hullColor = [0x9a4a3c, 0x3c5a7a, 0x5a6a5a][Math.floor(rand() * 3)];
  const hull = new THREE.Mesh(new THREE.BoxGeometry(22, 3, 5), new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.8 }));
  hull.position.y = 1.2;
  g.add(hull);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(4, 3.4, 4), new THREE.MeshStandardMaterial({ color: 0xd8d8d2, roughness: 0.7 }));
  bridge.position.set(-7.5, 4.2, 0);
  g.add(bridge);
  for (let i = 0; i < 5; i++) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.6, 3.8),
      new THREE.MeshStandardMaterial({ color: [0xc96f3a, 0x5a8fd0, 0x6fae6a, 0xd8b23a][i % 4], roughness: 0.8 }),
    );
    box.position.set(-2 + i * 2.9, 3.4, 0);
    g.add(box);
  }
  return g;
}

export function buildKite(color = 0xf291b4) {
  const g = new THREE.Group();
  const sail = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.7),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide }),
  );
  sail.rotation.z = Math.PI / 4;
  g.add(sail);
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const bow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.14), tailMat);
    bow.position.set(-0.5 - i * 0.5, -0.9 - i * 0.42, 0);
    bow.rotation.z = 0.6 + i * 0.5;
    g.add(bow);
  }
  return g;
}

// open-sided beach shelter with pitched roof
export function buildShelter() {
  const g = new THREE.Group();
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb5543e, roughness: 0.75 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4e, roughness: 0.85 });
  for (const [px, pz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.5, 8), postMat);
    post.position.set(px, 1.25, pz);
    post.castShadow = true;
    g.add(post);
  }
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.08, 2.6), roofMat);
    panel.position.set(0, 3.0 + 0.0, side * 1.05);
    panel.rotation.x = side * -0.5;
    panel.castShadow = true;
    g.add(panel);
  }
  const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 0.5), postMat);
  bench.position.set(0, 0.5, 0);
  g.add(bench);
  return g;
}
