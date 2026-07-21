// Web Speech wrapper: continuous en-SG recognition with auto-restart,
// plus an injection port used by the QA sim harness.

export class SpeechManager {
  constructor({ lang = 'en-SG' } = {}) {
    this.lang = lang;
    this.listeners = {};
    this.paused = false;
    this.running = false;
    this.restartDelay = 250;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.available = !!Ctor;
    this.simulated = false;
    if (this.available) {
      this.rec = new Ctor();
      this.rec.continuous = true;
      this.rec.interimResults = true;
      this.rec.lang = lang;
      this.rec.maxAlternatives = 4;
      this.rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          for (let a = 0; a < Math.min(res.length, 3); a++) {
            const alt = res[a];
            if (alt.transcript && alt.transcript.trim()) {
              this.#emit('heard', {
                text: alt.transcript,
                isFinal: res.isFinal,
                confidence: alt.confidence ?? 0.5,
              });
            }
          }
        }
      };
      this.rec.onend = () => {
        this.running = false;
        if (!this.paused) {
          setTimeout(() => this.#tryStart(), this.restartDelay);
          this.restartDelay = Math.min(2500, this.restartDelay * 1.4);
        }
      };
      this.rec.onstart = () => {
        this.running = true;
        this.restartDelay = 250;
        this.#emit('status', 'listening');
      };
      this.rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          this.available = false;
          this.#emit('mic-blocked');
        }
        // 'no-speech' and 'aborted' are routine; onend handles restart
      };
    }
  }

  // QA harness. Injected utterances are ADDITIVE — the real recogniser keeps
  // running so a stray ?sim=1 can never leave a real child unheard.
  useSimulation() {
    this.simulated = true;
  }

  injectUtterance(text, isFinal = true) {
    this.#emit('heard', { text, isFinal, confidence: 0.9, simulated: true });
  }

  start() {
    this.paused = false;
    if (this.simulated) this.#emit('status', 'listening');
    this.#tryStart();
  }

  #tryStart() {
    if (!this.available || this.paused || this.running) return;
    try { this.rec.start(); } catch { /* already started */ }
  }

  pause() {
    this.paused = true;
    if (this.available && this.running) {
      try { this.rec.stop(); } catch { /* noop */ }
    }
  }

  on(event, fn) {
    (this.listeners[event] ??= []).push(fn);
  }

  #emit(event, data) {
    for (const fn of this.listeners[event] ?? []) fn(data);
  }
}
