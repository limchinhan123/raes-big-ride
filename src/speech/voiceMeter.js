import { isMobileRuntime } from '../core/mobile.js';

// Mic level meter + simple voice-activity detection. Desktop keeps the richer
// analyser. Mobile reuses Web Speech activity so two consumers do not compete
// for the microphone or create another AudioContext.

export class VoiceMeter {
  constructor() {
    this.level = 0;
    this.available = false;
    this.voiceHold = 0;
    this.listeners = {};
    this.simLevel = 0;
    this.gain = 3.0; // mic boost — defaults near the top of the range
    this.mobile = isMobileRuntime();
    this.started = false;
  }

  async start() {
    if (this.started) return this.available;
    this.started = true;
    if (this.mobile) {
      this.available = true;
      return true;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      src.connect(this.analyser);
      this.buf = new Uint8Array(this.analyser.frequencyBinCount);
      this.available = true;
      this.ctx = ctx;
    } catch {
      this.available = false;
      this.started = false;
    }
    return this.available;
  }

  poke(level = 0.7) { this.simLevel = Math.max(this.simLevel, level); } // sim harness pulses the meter

  signalVoice(level = 0.72) {
    this.level = Math.max(this.level, level);
    this.poke(level);
    this.#emit('voice');
  }

  update(dt) {
    let target = 0;
    if (this.available && this.analyser) {
      this.analyser.getByteFrequencyData(this.buf);
      let sum = 0;
      for (let i = 2; i < 60; i++) sum += this.buf[i];
      target = Math.min(1, ((sum / 58) / 62) * this.gain);
    }
    if (this.simLevel > 0.01) {
      target = Math.max(target, this.simLevel);
      this.simLevel *= Math.exp(-dt * 2.2);
    }
    this.level += (target - this.level) * Math.min(1, dt * 12);
    if (this.level > 0.1) {
      this.voiceHold += dt;
      if (this.voiceHold > 0.08) this.#emit('voice');
    } else {
      this.voiceHold = 0;
    }
  }

  on(event, fn) { (this.listeners[event] ??= []).push(fn); }
  #emit(event, data) { for (const fn of this.listeners[event] ?? []) fn(data); }
}
