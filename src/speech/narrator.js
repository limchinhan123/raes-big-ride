// Gentle narrator voice via SpeechSynthesis. Models the words, praises,
// names passing sights. Muted cleanly for QA runs.

export class Narrator {
  constructor() {
    this.enabled = 'speechSynthesis' in window;
    this.muted = false;
    this.voice = null;
    this.speaking = false;
    this.listeners = {};
    if (this.enabled) {
      const pick = () => {
        const voices = speechSynthesis.getVoices();
        this.voice =
          voices.find((v) => v.lang === 'en-SG') ||
          voices.find((v) => v.lang?.startsWith('en-GB') && /female|Kate|Serena|Stephanie/i.test(v.name)) ||
          voices.find((v) => /Samantha|Karen|Moira/i.test(v.name)) ||
          voices.find((v) => v.lang?.startsWith('en')) || null;
      };
      pick();
      speechSynthesis.onvoiceschanged = pick;
    }
  }

  say(text, { rate = 0.95, pitch = 1.12, interrupt = false } = {}) {
    if (!this.enabled || this.muted) return Promise.resolve();
    return new Promise((resolve) => {
      if (interrupt) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.rate = rate;
      u.pitch = pitch;
      u.volume = 0.95;
      let finished = false;
      let startTimer = null;
      let completionTimer = null;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(startTimer);
        clearTimeout(completionTimer);
        this.speaking = false;
        this.#emit('end');
        resolve();
      };
      u.onstart = () => {
        clearTimeout(startTimer);
        this.speaking = true;
        this.#emit('start');
        completionTimer = setTimeout(() => {
          try { speechSynthesis.cancel(); } catch { /* already stopped */ }
          finish();
        }, 8000);
      };
      u.onend = finish;
      u.onerror = finish;
      // If a mobile synthesis queue never starts this line, cancel the stale
      // queue rather than letting it speak after recognition has begun.
      startTimer = setTimeout(() => {
        try { speechSynthesis.cancel(); } catch { /* already stopped */ }
        finish();
      }, 10000);
      try { speechSynthesis.speak(u); } catch { finish(); }
    });
  }

  on(event, fn) { (this.listeners[event] ??= []).push(fn); }
  #emit(event) { for (const fn of this.listeners[event] ?? []) fn(); }
}
