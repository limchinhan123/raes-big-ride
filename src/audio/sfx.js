// Synthesized sound effects + ambient beds. Shares nothing with the music
// engine so either can be muted independently.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.ambientGain = null;
  }

  async start() {
    if (this.ctx) return;
    // Build the whole graph SYNCHRONOUSLY. If we await before wiring, a
    // caller firing a sound on the same click (sfx.start(); sfx.pop()) hits
    // a half-built graph and throws on connect(undefined).
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.#ambientBed();
    await this.ctx.resume();
  }

  #noiseBuffer(dur = 2) {
    const n = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  #ambientBed() {
    // soft wind + distant birds
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.#noiseBuffer(3);
    noise.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.045;
    noise.connect(lp); lp.connect(this.ambientGain); this.ambientGain.connect(this.master);
    noise.start();
    this.#birdLoop();
  }

  #birdLoop() {
    if (!this.master) return;
    if (Math.random() < 0.5) this.#chirp();
    setTimeout(() => this.#birdLoop(), 2400 + Math.random() * 5200);
  }

  #chirp() {
    const t = this.ctx.currentTime;
    const n = 2 + Math.floor(Math.random() * 3);
    const base = 2600 + Math.random() * 1400;
    for (let i = 0; i < n; i++) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      const t0 = t + i * (0.09 + Math.random() * 0.05);
      o.frequency.setValueAtTime(base + Math.random() * 300, t0);
      o.frequency.exponentialRampToValueAtTime(base * 1.35, t0 + 0.05);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.028, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0004, t0 + 0.09);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + 0.12);
    }
  }

  bell() {
    if (!this.master) return;
    const t = this.ctx.currentTime;
    for (const [freq, delay] of [[2093, 0], [2637, 0.09]]) {
      const o = this.ctx.createOscillator();
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.exponentialRampToValueAtTime(0.22, t + delay + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0004, t + delay + 0.7);
      o.connect(g); g.connect(this.master);
      o.start(t + delay); o.stop(t + delay + 0.8);
    }
  }

  chime() {
    if (!this.master) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.frequency.value = f;
      const g = this.ctx.createGain();
      const t0 = t + i * 0.07;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0004, t0 + 0.85);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + 0.9);
    });
  }

  whoosh() {
    if (!this.master) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.#noiseBuffer(1);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 0.9);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 1);
  }

  pop() {
    if (!this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 0.22);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.25);
  }

  setSeaside(on) {
    if (!this.ambientGain) return;
    this.ambientGain.gain.setTargetAtTime(on ? 0.11 : 0.045, this.ctx.currentTime, 1.2);
  }
}
