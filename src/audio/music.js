// Generative soothing music: soft felt-piano notes over a warm pad, slow
// I–IV–vi–V in F major with pentatonic sparkles. All WebAudio, no assets.
// Ducks itself while the game is listening for Rae's voice.

const CHORDS = [
  [53, 60, 65, 69],   // F  (F3 C4 F4 A4)
  [46, 58, 65, 70],   // Bb
  [50, 57, 65, 69],   // Dm
  [48, 55, 64, 67],   // C
];
const SPARKLE_SCALE = [65, 67, 69, 72, 74, 77, 79, 81]; // F pentatonic-ish

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  constructor() {
    this.ctx = null;
    this.playing = false;
    this.step = 0;
    this.volume = 0.16;
  }

  async start() {
    if (this.playing) return;
    // graph is wired synchronously — see the note in sfx.js; awaiting first
    // lets a same-click caller touch half-built nodes and throw
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.duck = this.ctx.createGain();
    this.duck.gain.value = 1;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -22;
    this.duck.connect(this.master);
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    // warm pad bus with gentle lowpass
    this.padBus = this.ctx.createGain();
    this.padBus.gain.value = 0.35;
    const padLp = this.ctx.createBiquadFilter();
    padLp.type = 'lowpass'; padLp.frequency.value = 900;
    this.padBus.connect(padLp); padLp.connect(this.duck);

    this.keyBus = this.ctx.createGain();
    this.keyBus.gain.value = 0.8;
    const keyLp = this.ctx.createBiquadFilter();
    keyLp.type = 'lowpass'; keyLp.frequency.value = 2400;
    this.keyBus.connect(keyLp); keyLp.connect(this.duck);

    this.playing = true;
    this.barDur = 3.4; // slow, sleepy
    this.nextBar = this.ctx.currentTime + 0.1;
    this.#scheduler();
    await this.ctx.resume();
  }

  setListening(listening) {
    if (!this.duck) return;
    const t = this.ctx.currentTime;
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setTargetAtTime(listening ? 0.28 : 1, t, 0.4);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2);
  }

  #scheduler() {
    if (!this.playing) return;
    const ahead = 1.2;
    while (this.nextBar < this.ctx.currentTime + ahead) {
      this.#bar(this.nextBar, CHORDS[this.step % CHORDS.length]);
      this.nextBar += this.barDur;
      this.step++;
    }
    setTimeout(() => this.#scheduler(), 300);
  }

  #note(bus, midi, t, dur, peak, type = 'sine', detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = mtof(midi);
    o.detune.value = detune;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.04 + Math.random() * 0.03);
    g.gain.exponentialRampToValueAtTime(0.0004, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  #bar(t, chord) {
    // pad: two soft triangle layers on root+fifth
    this.#note(this.padBus, chord[0], t, this.barDur * 1.15, 0.16, 'triangle', -4);
    this.#note(this.padBus, chord[1], t, this.barDur * 1.15, 0.12, 'triangle', 4);
    this.#note(this.padBus, chord[2], t + 0.05, this.barDur * 1.1, 0.09, 'sine');
    // felt piano: broken chord
    const order = [0, 2, 1, 3];
    order.forEach((idx, i) => {
      if (Math.random() < 0.85) {
        this.#note(this.keyBus, chord[idx] + 12, t + 0.18 + i * (this.barDur / 5.4), 1.9, 0.11, 'sine');
      }
    });
    // sparkle melody: one or two high pentatonic touches per bar
    if (Math.random() < 0.8) {
      const n = SPARKLE_SCALE[Math.floor(Math.random() * SPARKLE_SCALE.length)];
      this.#note(this.keyBus, n + 12, t + this.barDur * (0.4 + Math.random() * 0.4), 1.6, 0.05, 'sine');
    }
  }
}
