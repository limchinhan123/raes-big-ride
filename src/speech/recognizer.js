import { isMobileRuntime } from '../core/mobile.js';

// Web Speech wrapper: continuous en-SG recognition on desktop and short,
// automatically renewed listening sessions on mobile. Mobile creates a fresh
// browser recognizer for each session so a stale Chrome service cannot leave
// the game silently deaf.

export class SpeechManager {
  constructor({ lang = 'en-SG' } = {}) {
    this.lang = lang;
    this.listeners = {};
    this.paused = false;
    this.wanted = false;
    this.running = false;
    this.starting = false;
    this.holds = new Set();
    this.mobile = isMobileRuntime();
    this.restartDelay = this.mobile ? 120 : 250;
    this.restartTimer = null;
    this.startWatchdog = null;
    this.hasStarted = false;
    this.lastTranscript = '';
    this.lastTranscriptAt = 0;
    this.Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.available = !!this.Ctor;
    this.simulated = false;

    if (this.available) {
      this.rec = this.#makeRecognizer();

      if (this.mobile) {
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            this.#clearRestart();
            this.#clearWatchdog();
            const rec = this.rec;
            this.running = false;
            this.starting = false;
            try { rec.abort(); } catch { /* already idle */ }
            this.#renewRecognizer(rec);
          } else {
            this.#scheduleRestart(100);
          }
        });
      }
    }
  }

  #makeRecognizer() {
    const rec = new this.Ctor();
    rec.continuous = !this.mobile;
    // Interim text removes the long end-of-speech wait on mobile. Callers use
    // exact-only matching for provisional results; fuzzy matches still wait
    // for a final transcript.
    rec.interimResults = true;
    rec.lang = this.lang;
    rec.maxAlternatives = this.mobile ? 1 : 4;

    rec.onspeechstart = () => {
      if (this.rec !== rec) return;
      if (this.mobile && this.wanted && !this.paused && this.holds.size === 0) {
        this.#emit('activity');
      }
    };

    rec.onresult = (e) => {
      if (this.rec !== rec || !this.wanted || this.paused || this.holds.size > 0 || document.hidden) return;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        for (let a = 0; a < Math.min(res.length, this.mobile ? 1 : 3); a++) {
          const alt = res[a];
          if (!alt.transcript?.trim()) continue;
          const text = alt.transcript.trim();
          const normalized = text.toLowerCase();
          const now = performance.now();
          // Suppress repeated provisional guesses, but always allow the final
          // version through after an interim result with the same text.
          if (this.mobile && !res.isFinal
            && normalized === this.lastTranscript
            && now - this.lastTranscriptAt < 700) continue;
          this.lastTranscript = normalized;
          this.lastTranscriptAt = now;
          if (this.mobile) this.#emit('voice');
          this.#emit('heard', {
            text,
            isFinal: res.isFinal,
            confidence: alt.confidence ?? 0.5,
          });
        }
      }
    };

    rec.onend = () => {
      if (this.rec !== rec) return;
      this.running = false;
      this.starting = false;
      this.#clearWatchdog();
      if (this.mobile && this.available) this.#renewRecognizer(rec);
      this.#scheduleRestart(this.restartDelay);
      this.restartDelay = Math.min(2500, this.restartDelay * 1.4);
    };

    rec.onstart = () => {
      if (this.rec !== rec) return;
      this.starting = false;
      this.#clearWatchdog();
      if (!this.wanted || this.paused || this.holds.size > 0 || document.hidden) {
        this.running = false;
        try { rec.abort(); } catch { /* already idle */ }
        return;
      }
      this.running = true;
      this.hasStarted = true;
      this.restartDelay = this.mobile ? 120 : 250;
      this.#emit('status', 'listening');
    };

    rec.onerror = (e) => {
      if (this.rec !== rec) return;
      this.running = false;
      this.starting = false;
      this.#clearWatchdog();
      this.#emit('error', e.error);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed'
        || e.error === 'language-not-supported') {
        this.available = false;
        this.#clearRestart();
        this.#emit('mic-blocked', e.error);
        return;
      }
      // `onend` normally follows recoverable errors. Replace the mobile
      // recognizer now so recovery also works on builds that omit `onend`.
      if (this.mobile) this.#renewRecognizer(rec);
      this.#scheduleRestart(e.error === 'no-speech' ? 120 : 300);
    };

    return rec;
  }

  #renewRecognizer(expected = this.rec) {
    if (!this.available || !this.Ctor || this.rec !== expected) return;
    expected.onstart = null;
    expected.onend = null;
    expected.onerror = null;
    expected.onresult = null;
    expected.onspeechstart = null;
    this.rec = this.#makeRecognizer();
  }

  // QA harness. Injected utterances are ADDITIVE — the real recogniser keeps
  // running so a stray ?sim=1 can never leave a real child unheard.
  useSimulation() {
    this.simulated = true;
  }

  injectUtterance(text, isFinal = true) {
    this.#emit('heard', { text, isFinal, confidence: 0.9, simulated: true });
  }

  start({ immediate = false } = {}) {
    this.wanted = true;
    this.paused = false;
    if (this.simulated) this.#emit('status', 'listening');
    if (this.mobile && immediate) {
      this.#clearRestart();
      this.#tryStart();
    } else {
      this.#scheduleRestart(0);
    }
  }

  #tryStart() {
    if (!this.available || !this.wanted || this.paused || this.holds.size > 0
      || this.running || this.starting || document.hidden) return;
    this.starting = true;
    const rec = this.rec;
    try {
      this.#emit('status', 'starting');
      rec.start();
      if (this.mobile && this.starting && !this.running) {
        // Chrome's first `onstart` waits until its permission prompt is
        // accepted. Give an adult time to respond; later starts use a shorter
        // watchdog and swap in a fresh recognizer if the service is stale.
        const timeout = this.hasStarted ? 3500 : 15000;
        this.startWatchdog = setTimeout(() => {
          if (this.rec !== rec || !this.starting || this.running || this.paused) return;
          this.starting = false;
          try { rec.abort(); } catch { /* already idle */ }
          this.#renewRecognizer(rec);
          this.#emit('status', 'reconnecting');
          this.#scheduleRestart(250);
        }, timeout);
      }
    } catch {
      this.starting = false;
      this.#clearWatchdog();
      if (this.mobile) {
        try { rec.abort(); } catch { /* already idle */ }
        this.#renewRecognizer(rec);
      }
      this.#scheduleRestart(this.restartDelay);
      this.restartDelay = Math.min(2500, this.restartDelay * 1.4);
    }
  }

  #scheduleRestart(delay) {
    this.#clearRestart();
    if (!this.available || !this.wanted || this.paused || this.holds.size > 0 || document.hidden) return;
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
    this.wanted = false;
    this.paused = true;
    this.#clearRestart();
    this.#clearWatchdog();
    if (this.available && (this.running || this.starting)) {
      const rec = this.rec;
      try { this.mobile ? rec.abort() : rec.stop(); } catch { /* noop */ }
      if (this.mobile) this.#renewRecognizer(rec);
    }
    this.running = false;
    this.starting = false;
  }

  // Temporarily discard recognition while the helper voice is playing. This
  // prevents the device speaker from answering its own prompt without turning
  // a real game pause into an automatic resume.
  hold(reason) {
    this.holds.add(reason);
    this.#clearRestart();
    this.#clearWatchdog();
    if (this.available && (this.running || this.starting)) {
      const rec = this.rec;
      try { rec.abort(); } catch { /* already idle */ }
      if (this.mobile) this.#renewRecognizer(rec);
    }
    this.running = false;
    this.starting = false;
  }

  release(reason) {
    this.holds.delete(reason);
    if (this.holds.size === 0 && this.wanted && !this.paused) this.#scheduleRestart(80);
  }

  on(event, fn) {
    (this.listeners[event] ??= []).push(fn);
  }

  #emit(event, data) {
    for (const fn of this.listeners[event] ?? []) fn(data);
  }
}
