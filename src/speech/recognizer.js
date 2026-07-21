import { isMobileRuntime } from '../core/mobile.js';

// Web Speech wrapper: continuous en-SG recognition on desktop and short,
// automatically renewed listening sessions on mobile. The latter avoids the
// long-lived sessions Chrome mobile tends to suspend after lifecycle changes.

export class SpeechManager {
  constructor({ lang = 'en-SG' } = {}) {
    this.lang = lang;
    this.listeners = {};
    this.paused = false;
    this.running = false;
    this.starting = false;
    this.mobile = isMobileRuntime();
    this.restartDelay = this.mobile ? 120 : 250;
    this.restartTimer = null;
    this.startWatchdog = null;
    this.lastTranscript = '';
    this.lastTranscriptAt = 0;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.available = !!Ctor;
    this.simulated = false;
    if (this.available) {
      this.rec = new Ctor();
      this.rec.continuous = !this.mobile;
      this.rec.interimResults = true;
      this.rec.lang = lang;
      this.rec.maxAlternatives = this.mobile ? 1 : 4;
      this.rec.onspeechstart = () => {
        if (this.mobile) this.#emit('activity');
      };
      this.rec.onresult = (e) => {
        if (this.paused || document.hidden) return;
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          for (let a = 0; a < Math.min(res.length, this.mobile ? 1 : 3); a++) {
            const alt = res[a];
            if (alt.transcript && alt.transcript.trim()) {
              const text = alt.transcript.trim();
              const now = performance.now();
              if (this.mobile
                && text.toLowerCase() === this.lastTranscript
                && now - this.lastTranscriptAt < 700) continue;
              this.lastTranscript = text.toLowerCase();
              this.lastTranscriptAt = now;
              if (this.mobile) this.#emit('voice');
              this.#emit('heard', {
                text,
                isFinal: res.isFinal,
                confidence: alt.confidence ?? 0.5,
              });
            }
          }
        }
      };
      this.rec.onend = () => {
        this.running = false;
        this.starting = false;
        this.#clearWatchdog();
        this.#scheduleRestart(this.restartDelay);
        this.restartDelay = Math.min(2500, this.restartDelay * 1.4);
      };
      this.rec.onstart = () => {
        this.starting = false;
        this.#clearWatchdog();
        if (this.paused || document.hidden) {
          this.running = false;
          try { this.rec.abort(); } catch { /* already idle */ }
          return;
        }
        this.running = true;
        this.restartDelay = this.mobile ? 120 : 250;
        this.#emit('status', 'listening');
      };
      this.rec.onerror = (e) => {
        this.running = false;
        this.starting = false;
        this.#clearWatchdog();
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed'
          || e.error === 'language-not-supported') {
          this.available = false;
          this.#clearRestart();
          this.#emit('mic-blocked');
          return;
        }
        // `onend` normally follows recoverable errors. This timer is a
        // fallback for mobile Chrome builds that occasionally omit it.
        this.#scheduleRestart(e.error === 'no-speech' ? 120 : 300);
      };

      if (this.mobile) {
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            this.#clearRestart();
            this.#clearWatchdog();
            this.running = false;
            this.starting = false;
            try { this.rec.abort(); } catch { /* already idle */ }
          } else {
            this.#scheduleRestart(100);
          }
        });
      }
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
    this.#scheduleRestart(0);
  }

  #tryStart() {
    if (!this.available || this.paused || this.running || this.starting || document.hidden) return;
    this.starting = true;
    try {
      this.rec.start();
      if (this.mobile) {
        this.startWatchdog = setTimeout(() => {
          if (!this.starting || this.running || this.paused) return;
          this.starting = false;
          try { this.rec.abort(); } catch { /* already idle */ }
          this.#scheduleRestart(200);
        }, 1800);
      }
    } catch {
      this.starting = false;
      this.#clearWatchdog();
      // A stale browser-side session can throw even though our `onend`
      // already ran. Reset it on mobile, then keep retrying instead of
      // silently leaving the microphone dead.
      if (this.mobile) {
        try { this.rec.abort(); } catch { /* already idle */ }
      }
      this.#scheduleRestart(this.restartDelay);
      this.restartDelay = Math.min(2500, this.restartDelay * 1.4);
    }
  }

  #scheduleRestart(delay) {
    this.#clearRestart();
    if (!this.available || this.paused || document.hidden) return;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.#tryStart();
    }, delay);
  }

  #clearRestart() {
    if (this.restartTimer != null) clearTimeout(this.restartTimer);
    this.restartTimer = null;
  }

  #clearWatchdog() {
    if (this.startWatchdog != null) clearTimeout(this.startWatchdog);
    this.startWatchdog = null;
  }

  pause() {
    this.paused = true;
    this.#clearRestart();
    this.#clearWatchdog();
    if (this.available && (this.running || this.starting)) {
      try { this.rec.stop(); } catch { /* noop */ }
    }
    this.running = false;
    this.starting = false;
  }

  on(event, fn) {
    (this.listeners[event] ??= []).push(fn);
  }

  #emit(event, data) {
    for (const fn of this.listeners[event] ?? []) fn(data);
  }
}
