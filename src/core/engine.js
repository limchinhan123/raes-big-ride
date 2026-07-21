import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { isMobileRuntime } from './mobile.js';

// Final display-referred grade: gentle vignette, warmth lift, saturation.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.3 },
    uSaturation: { value: 1.07 },
    uGamma: { value: 0.88 },
    uLift: { value: new THREE.Color(0x060504) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uSaturation;
    uniform float uGamma;
    uniform vec3 uLift;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb = pow(max(c.rgb, 0.0), vec3(uGamma)); // lifted filmic blacks
      float g = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(g), c.rgb, uSaturation);
      c.rgb += uLift * (1.0 - g);
      vec2 q = vUv - 0.5;
      float vig = 1.0 - uVignette * smoothstep(0.35, 0.95, length(q) * 1.35);
      c.rgb *= vig;
      gl_FragColor = c;
    }
  `,
};

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.mobile = isMobileRuntime();
    // ?capture keeps the drawing buffer so toDataURL can export README frames
    const params = new URLSearchParams(location.search);
    const captureMode = params.has('capture');
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      preserveDrawingBuffer: captureMode,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = !this.mobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    // near/far ratio drives depth precision. 0.1/2200 crammed the whole
    // distance into a sliver of the depth buffer and caused far-field
    // z-fighting; nothing is ever closer than ~0.5m to this chase camera and
    // fog fully hides anything past ~1200m.
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.5, 1600);
    this.scene.add(this.camera);

    const size = this.#viewSize();
    const rt = new THREE.WebGLRenderTarget(size.w, size.h, {
      samples: this.mobile ? 0 : 2,
      type: this.mobile ? THREE.UnsignedByteType : THREE.HalfFloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.w, size.h), 0.16, 0.7, 0.86);
    this.bloomPass.enabled = !this.mobile;
    this.outputPass = new OutputPass();
    this.gradePass = new ShaderPass(GradeShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);
    this.composer.addPass(this.gradePass);

    this.noFx = params.has('nofx');
    this.clock = new THREE.Clock();
    this.time = 0;
    this.timeScale = 1;
    this.updaters = [];
    this.fps = { frames: 0, accum: 0, value: 60, history: [] };

    this.#applySize();
    window.addEventListener('resize', () => this.#applySize());
  }

  #viewSize() {
    // Retina at full 2x means ~5.7M pixels through MSAA + bloom every frame,
    // which starves the GPU and shows up as dropped/flickering frames. 1.5x
    // looks near-identical and costs ~44% less. this.quality drops further if
    // we still can't hold frame rate.
    const dprCap = this.mobile ? 1 : 1.5;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap) * (this.quality ?? 1);
    return { w: Math.floor(innerWidth * dpr), h: Math.floor(innerHeight * dpr), dpr };
  }

  // Composer takes LOGICAL pixels and multiplies by its own pixel ratio —
  // feeding it physical pixels double-scales on Retina (dpr²), leaving the
  // scene in the left half of the canvas and garbage flicker in the rest.
  #applySize() {
    const { dpr } = this.#viewSize();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  onUpdate(fn) { this.updaters.push(fn); }

  // If the machine can't hold frame rate, shed pixels then post-processing
  // rather than letting the display drop frames (which reads as flicker).
  #autoQuality() {
    if (this.paused || this.autoQualityOff) return;
    this._lowStreak = this.fps.value < 48 ? (this._lowStreak ?? 0) + 1 : 0;
    if (this._lowStreak < 4) return;   // ~2s sustained, ignore load spikes
    this._lowStreak = 0;
    if ((this.quality ?? 1) > 0.75) {
      this.quality = 0.75;
      this.#applySize();
      console.warn('[perf] reduced resolution to hold frame rate');
    } else if (this.bloomPass.enabled) {
      this.bloomPass.enabled = false;
      console.warn('[perf] disabled bloom to hold frame rate');
    }
  }

  setPaused(paused) {
    this.paused = paused;
    this.clock.getDelta(); // drop the accumulated gap so we don't jump on resume
  }

  #tick() {
    const trueDt = this.clock.getDelta();
    const rawDt = Math.min(trueDt, 0.05);
    const dt = rawDt * this.timeScale;
    // ?nofx=1 bypasses all post-processing — a diagnostic: if flicker stops
    // with this on, the composer/render-target path is the culprit.
    const draw = this.noFx
      ? () => this.renderer.render(this.scene, this.camera)
      : () => this.composer.render();
    if (this.paused) { draw(); return; }
    this.time += dt;
    for (const fn of this.updaters) fn(dt, this.time, rawDt);
    draw();
    this.fps.frames++;
    this.fps.accum += trueDt;
    if (this.fps.accum >= 0.5) {
      this.fps.value = this.fps.frames / this.fps.accum;
      this.fps.history.push(this.fps.value);
      if (this.fps.history.length > 600) this.fps.history.shift();
      this.fps.frames = 0; this.fps.accum = 0;
      this.#autoQuality();
    }
  }

  start() {
    // RULE: rendering ONLY ever happens inside requestAnimationFrame. WebGL
    // presentation must be synced to the compositor — drawing from a timer or
    // worker callback lets the browser composite a half-drawn canvas, which
    // reads as violent full-screen flicker on a real display.
    this.renderer.setAnimationLoop(() => this.#tick());

    // QA harness only: embedded preview panes are treated as "hidden" and get
    // rAF throttled to ~0. A worker heartbeat keeps the sim advancing THERE
    // and nowhere else — when the page is visible this never fires, so a
    // stray ?interval=1 can no longer break real play.
    const params = new URLSearchParams(location.search);
    if (params.has('interval')) {
      const src = 'setInterval(() => postMessage(0), 16);';
      const worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = () => { if (document.hidden) this.#tick(); };
    }
  }
}
