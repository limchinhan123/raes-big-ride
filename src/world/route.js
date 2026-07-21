import * as THREE from 'three';
import { fbm1 } from '../core/prng.js';

// The master journey line. XZ path from integrated heading noise (gentle
// meanders), Y from a separate elevation profile so slopes stay child-gentle.
// Everything in the world hangs off (s, d) coordinates: s = meters along the
// route, d = signed lateral meters (+ is right of travel).

export const CHAPTERS = [
  { id: 'heartland', frac: [0.00, 0.18], hills: 0.55, turn: 1.0 },
  { id: 'connector', frac: [0.18, 0.36], hills: 1.00, turn: 1.0 },
  { id: 'market', frac: [0.36, 0.52], hills: 0.35, turn: 0.8 },
  { id: 'coast', frac: [0.52, 0.70], hills: 0.16, turn: 0.28 },
  { id: 'city', frac: [0.70, 0.87], hills: 0.42, turn: 0.7 },
  { id: 'finale', frac: [0.87, 1.00], hills: 0.30, turn: 0.55 },
];

const smoothstep = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export class Route {
  constructor({ length = 1800, seed = 5 } = {}) {
    this.length = length;
    this.seed = seed;
    this.step = 0.5; // lookup resolution in meters
    this.#build();
  }

  #paramAt(s, key) {
    const u = s / this.length;
    let scale = CHAPTERS[0][key];
    for (let i = 0; i < CHAPTERS.length; i++) {
      const [a] = CHAPTERS[i].frac;
      if (i > 0) {
        const w = 0.022; // blend width in route fraction
        scale = THREE.MathUtils.lerp(scale, CHAPTERS[i][key], smoothstep(a - w, a + w, u));
      }
    }
    return scale;
  }

  #hillScaleAt(s) { return this.#paramAt(s, 'hills'); }

  elevationAt(s) {
    const sc = this.#hillScaleAt(s);
    const base =
      (fbm1(s * 0.0031 + this.seed * 10, 3, 3) - 0.5) * 2 * 4.2 +
      (fbm1(s * 0.0093 + 60 + this.seed, 3, 4) - 0.5) * 2 * 1.5;
    // settle to a friendly flat approach at the very end (playground arrival)
    const endFlat = smoothstep(0.955, 0.995, s / this.length);
    return base * sc * (1 - endFlat) + 0.0;
  }

  #build() {
    const N = Math.ceil(this.length / this.step) + 2;
    this.px = new Float32Array(N); this.pz = new Float32Array(N);
    this.py = new Float32Array(N);
    this.tx = new Float32Array(N); this.tz = new Float32Array(N);
    this.slope = new Float32Array(N);
    this.N = N;

    // pronounced planned bends — the journey should feel like real corners,
    // not a near-straight drift (kept away from the zebra crossings)
    const bends = [0.075, 0.2, 0.335, 0.475, 0.585, 0.71, 0.9].map((f, i) => ({
      c: f * this.length,
      sign: i % 2 === 0 ? 1 : -1,
      k: 0.026 + ((i * 37) % 10) * 0.0009,
      w: 13 + ((i * 53) % 8),
    }));

    let x = 0, z = 0, heading = Math.PI; // facing -Z
    for (let i = 0; i < N; i++) {
      const s = i * this.step;
      this.px[i] = x; this.pz[i] = z;
      const dirx = Math.sin(heading), dirz = Math.cos(heading);
      this.tx[i] = dirx; this.tz[i] = dirz;
      // meander: layered sines + noise, curvature capped
      let turn =
        0.0085 * Math.sin((s / 232) * Math.PI * 2 + this.seed) +
        0.0065 * Math.sin((s / 401) * Math.PI * 2 + 1.9 + this.seed * 2) +
        (fbm1(s * 0.004 + this.seed * 31, 3, 7) - 0.5) * 2 * 0.006;
      turn = THREE.MathUtils.clamp(turn, -0.013, 0.013) * this.#paramAt(s, 'turn');
      for (const b of bends) {
        const q = (s - b.c) / b.w;
        turn += b.sign * b.k * Math.exp(-q * q);
      }
      heading += turn * this.step;
      x += dirx * this.step;
      z += dirz * this.step;
    }
    for (let i = 0; i < N; i++) {
      const s = i * this.step;
      this.py[i] = this.elevationAt(s);
      const e = 2.0;
      this.slope[i] = (this.elevationAt(s + e) - this.elevationAt(s - e)) / (2 * e);
    }
  }

  #idx(s) {
    const f = THREE.MathUtils.clamp(s / this.step, 0, this.N - 2);
    const i = Math.floor(f);
    return [i, f - i];
  }

  posAt(s, out = new THREE.Vector3()) {
    const [i, t] = this.#idx(s);
    out.set(
      THREE.MathUtils.lerp(this.px[i], this.px[i + 1], t),
      THREE.MathUtils.lerp(this.py[i], this.py[i + 1], t),
      THREE.MathUtils.lerp(this.pz[i], this.pz[i + 1], t),
    );
    return out;
  }

  dirAt(s, out = new THREE.Vector3()) {
    const [i, t] = this.#idx(s);
    out.set(
      THREE.MathUtils.lerp(this.tx[i], this.tx[i + 1], t), 0,
      THREE.MathUtils.lerp(this.tz[i], this.tz[i + 1], t),
    );
    return out.normalize();
  }

  rightAt(s, out = new THREE.Vector3()) {
    const [i, t] = this.#idx(s);
    const dx = THREE.MathUtils.lerp(this.tx[i], this.tx[i + 1], t);
    const dz = THREE.MathUtils.lerp(this.tz[i], this.tz[i + 1], t);
    const inv = 1 / Math.hypot(dx, dz);
    // right of travel = dir x up
    out.set(-dz * inv, 0, dx * inv);
    return out;
  }

  slopeAt(s) {
    const [i, t] = this.#idx(s);
    return THREE.MathUtils.lerp(this.slope[i], this.slope[i + 1], t);
  }

  yAt(s) {
    const [i, t] = this.#idx(s);
    return THREE.MathUtils.lerp(this.py[i], this.py[i + 1], t);
  }

  lateral(s, d, y = null, out = new THREE.Vector3()) {
    const [i, t] = this.#idx(s);
    const dx = THREE.MathUtils.lerp(this.tx[i], this.tx[i + 1], t);
    const dz = THREE.MathUtils.lerp(this.tz[i], this.tz[i + 1], t);
    const inv = 1 / Math.hypot(dx, dz);
    const rx = -dz * inv, rz = dx * inv;
    out.set(
      THREE.MathUtils.lerp(this.px[i], this.px[i + 1], t) + rx * d,
      y ?? THREE.MathUtils.lerp(this.py[i], this.py[i + 1], t),
      THREE.MathUtils.lerp(this.pz[i], this.pz[i + 1], t) + rz * d,
    );
    return out;
  }

  chapterAt(s) {
    const u = THREE.MathUtils.clamp(s / this.length, 0, 0.9999);
    for (let i = 0; i < CHAPTERS.length; i++) {
      const [a, b] = CHAPTERS[i].frac;
      if (u >= a && u < b) return { index: i, id: CHAPTERS[i].id, t: (u - a) / (b - a) };
    }
    return { index: CHAPTERS.length - 1, id: 'finale', t: 1 };
  }

  sOfFrac(f) { return f * this.length; }
}
