import * as THREE from 'three';
import { cloudPuffTexture } from '../core/textures.js';
import { mulberry32 } from '../core/prng.js';

const V = new THREE.Vector3();

// Authored gradient sky dome (summer-afternoon style) — every value is under
// artistic control, no physical-sky HDR blowouts. Sun disc + contained halo.

const KEYS = [
  {
    k: 0, // soft morning
    elevation: 16, azimuth: 78,
    zenith: 0x6d9ed6, horizon: 0xe6edf0, haze: 0xedf1f3,
    skySun: 0xfff6e0, halo: 0xfff0d0, haloPow: 22, haloInt: 0.5,
    sun: 0xfff0d8, sunI: 2.9,
    hemiSky: 0xbcd6ee, hemiGround: 0x8e935f, hemiI: 0.82,
    fog: 0xdce4e8, fogD: 0.0026,
    exposure: 0.95,
  },
  {
    k: 0.5, // clear noon
    elevation: 54, azimuth: 152,
    zenith: 0x3f7cc9, horizon: 0xcadcea, haze: 0xdde8ee,
    skySun: 0xffffff, halo: 0xeef4ff, haloPow: 40, haloInt: 0.3,
    sun: 0xffffff, sunI: 3.3,
    hemiSky: 0xc6def2, hemiGround: 0x8f9662, hemiI: 0.92,
    fog: 0xd6e0e6, fogD: 0.0022,
    exposure: 1.0,
  },
  {
    k: 1, // bright late-afternoon glow (still daytime, just warmer)
    elevation: 24, azimuth: 205,
    zenith: 0x6f8cc2, horizon: 0xf6c690, haze: 0xecd0a8,
    skySun: 0xfff4d4, halo: 0xffc078, haloPow: 12, haloInt: 0.55,
    sun: 0xffd9a8, sunI: 3.0,
    hemiSky: 0xe8cba8, hemiGround: 0x8a7a54, hemiI: 0.68,
    fog: 0xe8cca2, fogD: 0.0017,
    exposure: 1.02,
  },
];

function lerpKeys(k) {
  k = THREE.MathUtils.clamp(k, 0, 1);
  let a = KEYS[0], b = KEYS[1];
  if (k > 0.5) { a = KEYS[1]; b = KEYS[2]; }
  const t = k <= 0.5 ? k / 0.5 : (k - 0.5) / 0.5;
  const L = (x, y) => THREE.MathUtils.lerp(x, y, t);
  const C = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), t);
  return {
    elevation: L(a.elevation, b.elevation), azimuth: L(a.azimuth, b.azimuth),
    zenith: C(a.zenith, b.zenith), horizon: C(a.horizon, b.horizon), haze: C(a.haze, b.haze),
    skySun: C(a.skySun, b.skySun), halo: C(a.halo, b.halo),
    haloPow: L(a.haloPow, b.haloPow), haloInt: L(a.haloInt, b.haloInt),
    sun: C(a.sun, b.sun), sunI: L(a.sunI, b.sunI),
    hemiSky: C(a.hemiSky, b.hemiSky), hemiGround: C(a.hemiGround, b.hemiGround), hemiI: L(a.hemiI, b.hemiI),
    fog: C(a.fog, b.fog), fogD: L(a.fogD, b.fogD),
    exposure: L(a.exposure, b.exposure),
  };
}

export class SkyRig {
  constructor(engine) {
    this.engine = engine;
    const scene = engine.scene;

    this.skyUniforms = {
      uZenith: { value: new THREE.Color(0x3f7cc9) },
      uHorizon: { value: new THREE.Color(0xcadcea) },
      uHaze: { value: new THREE.Color(0xdde8ee) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(0xffffff) },
      uHalo: { value: new THREE.Color(0xeef4ff) },
      uHaloPow: { value: 40 },
      uHaloInt: { value: 0.3 },
      uDiscCos: { value: Math.cos(THREE.MathUtils.degToRad(0.62)) },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(100, 32, 20),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms,
        side: THREE.BackSide,
        // The sky is a BACKDROP: it must never take part in the depth test.
        // With depthTest on it fought the distant ground for the same depth
        // bucket and dropped out on alternate frames — that read as violent
        // whole-screen flicker, worst where the horizon is wide open.
        depthTest: false,
        depthWrite: false,
        fog: false,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = position;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vDir;
          uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uHaze;
          uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uHalo;
          uniform float uHaloPow; uniform float uHaloInt; uniform float uDiscCos;
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 col = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.55, h), 0.72));
            col = mix(col, uHaze, smoothstep(0.0, -0.16, h));
            float sd = dot(d, uSunDir);
            float band = (1.0 - smoothstep(0.0, 0.38, abs(h))) * pow(max(sd, 0.0), 3.0);
            col = mix(col, uHalo, band * 0.5);
            col += uHalo * pow(max(sd, 0.0), uHaloPow) * uHaloInt;
            float disc = smoothstep(uDiscCos - 0.00012, uDiscCos + 0.00008, sd);
            col += uSunColor * disc * 1.9;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    );
    this.sky.renderOrder = -1000; // painted before everything else
    scene.add(this.sky);

    this.sunDir = new THREE.Vector3(0, 1, 0);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24;
    sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xcfe3f7, 0x9aa070, 0.85);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0x93a3ba, 0.14);
    scene.add(this.ambient);

    scene.fog = new THREE.FogExp2(0xd8e2e8, 0.0035);

    const glowTex = cloudPuffTexture();
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xfff2cc, transparent: true, opacity: 0.4,
      depthWrite: false, fog: false,
    }));
    this.sunGlow.scale.setScalar(115);
    scene.add(this.sunGlow);

    // giant far-ground disc closes every below-horizon gap the heightfield leaves
    // kept comfortably inside the far plane so it never clips or fights
    this.farGround = new THREE.Mesh(
      new THREE.CircleGeometry(1400, 48),
      // pushed back in depth so it can never fight the real terrain either
      new THREE.MeshLambertMaterial({
        color: 0x5c7345,
        polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 8,
      }),
    );
    this.farGround.renderOrder = -900;
    this.farGround.rotation.x = -Math.PI / 2;
    this.farGround.position.y = -2.5;
    this.farGround.receiveShadow = false;
    scene.add(this.farGround);

    this.clouds = new THREE.Group();
    scene.add(this.clouds);
    this.#buildClouds();

    this.timeOfDay = 0.5;
    this.setTimeOfDay(0.5);
  }

  #buildClouds() {
    const tex = cloudPuffTexture();
    const rand = mulberry32(2024);
    const mkCloud = (dist, ang, alt, scale, puffs, opacity) => {
      const g = new THREE.Group();
      for (let i = 0; i < puffs; i++) {
        const m = new THREE.SpriteMaterial({
          map: tex, transparent: true, opacity: opacity * (0.3 + rand() * 0.3),
          depthWrite: false, fog: false,
        });
        const s = new THREE.Sprite(m);
        const spread = scale * (0.8 + rand() * 0.3);
        s.position.set((rand() - 0.5) * spread * 3.0, (rand() - 0.5) * spread * 0.55, (rand() - 0.5) * spread * 0.8);
        s.scale.setScalar(scale * (0.5 + rand() * 0.8));
        g.add(s);
      }
      g.position.set(Math.cos(ang) * dist, alt, Math.sin(ang) * dist);
      g.userData.drift = 0.5 + rand() * 1.2;
      this.clouds.add(g);
    };
    // distances kept well inside the camera far plane so no cloud ever sits
    // on the clipping boundary and pops in and out
    for (let i = 0; i < 9; i++) mkCloud(420 + rand() * 340, rand() * Math.PI * 2, 180 + rand() * 200, 90 + rand() * 120, 6, 0.75);
    for (let i = 0; i < 4; i++) mkCloud(700 + rand() * 300, rand() * Math.PI * 2, 120 + rand() * 80, 220 + rand() * 160, 8, 0.85);
  }

  setTimeOfDay(k) {
    this.timeOfDay = k;
    const p = lerpKeys(k);
    const u = this.skyUniforms;
    u.uZenith.value.copy(p.zenith);
    u.uHorizon.value.copy(p.horizon);
    u.uHaze.value.copy(p.haze);
    u.uSunColor.value.copy(p.skySun);
    u.uHalo.value.copy(p.halo);
    u.uHaloPow.value = p.haloPow;
    u.uHaloInt.value = p.haloInt;
    const phi = THREE.MathUtils.degToRad(90 - p.elevation);
    const theta = THREE.MathUtils.degToRad(p.azimuth);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    u.uSunDir.value.copy(this.sunDir);
    this.sun.color.copy(p.sun);
    this.sun.intensity = p.sunI;
    this.hemi.color.copy(p.hemiSky);
    this.hemi.groundColor.copy(p.hemiGround);
    this.hemi.intensity = p.hemiI;
    this.engine.scene.fog.color.copy(p.fog);
    this.engine.scene.fog.density = p.fogD;
    this.engine.renderer.toneMappingExposure = p.exposure;
    this.sunGlow.material.color.copy(p.halo).lerp(new THREE.Color(0xffffff), 0.45);
    this.sunGlow.material.opacity = 0.22 + 0.18 * (1 - Math.min(1, p.elevation / 40));
  }

  // Keep sun + shadow frustum riding along with the player.
  update(dt, focus) {
    if (focus) {
      V.copy(this.sunDir).multiplyScalar(90);
      this.sun.position.copy(focus).add(V);
      this.sun.target.position.copy(focus);
      this.sunGlow.position.copy(focus).addScaledVector(this.sunDir, 2600);
      this.sky.position.copy(focus);
      this.farGround.position.x = focus.x;
      this.farGround.position.z = focus.z;
      // CRITICAL: the disc must ride DOWN with the terrain, not stay frozen.
      // Pinned at a fixed height it sat 2.5m below the origin — fine on flat
      // ground, but with the bigger hills the chase camera dips to ~terrain+1.45
      // in a valley and skims the frozen disc edge-on, sheeting green over the
      // whole lower screen and burying Rae to the neck. Keep it a fixed 2.5m
      // below her local ground so it only ever closes the far horizon gap.
      this.farGround.position.y = focus.y - 2.5;
    }
    // Clouds ride WITH the player, like the sky dome does. Left pinned to the
    // world origin they ended up ~1700m behind by the end of the journey,
    // straddling the far plane and flickering in and out of frame.
    if (focus) {
      this.clouds.position.x = focus.x;
      this.clouds.position.z = focus.z;
    }
    for (const cl of this.clouds.children) {
      cl.position.x += cl.userData.drift * dt;
      if (cl.position.x > 1100) cl.position.x -= 2200;  // wrap, never escapes
    }
  }
}
