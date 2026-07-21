import { mulberry32 } from '../core/prng.js';

// QA voice harness: answers clue cards like a (mostly) cooperative
// four-year-old — usually right, sometimes wrong, sometimes shy.

export class SimDriver {
  constructor({ director, speech, meter, seed = 42, cooperative = 0.8 }) {
    this.director = director;
    this.speech = speech;
    this.meter = meter;
    this.rand = mulberry32(seed);
    this.cooperative = cooperative;
    this.pending = null;
    this.lastEventId = null;
    this.lastPhase = null;
  }

  update(dt, t) {
    const d = this.director;
    const ev = d.active;
    if (!ev) { this.lastEventId = null; this.pending = null; return; }

    const evKey = ev.id + ':' + (ev.phase ?? '-');
    if (evKey !== this.lastEventId) {
      this.lastEventId = evKey;
      this.pending = null;
      // decide behavior for this event/phase
      if (ev.kind === 'whee') {
        this.pending = { at: t + 1.0 + this.rand() * 1.2, action: 'voice' };
      } else if (ev.targets?.length) {
        const roll = this.rand();
        const target = ev.targets[Math.floor(this.rand() * ev.targets.length)];
        const word = target.say[0];
        if (roll < this.cooperative) {
          this.pending = { at: t + 1.2 + this.rand() * 1.6, action: 'say', text: word };
        } else if (roll < this.cooperative + 0.1) {
          this.pending = { at: t + 1.4, action: 'say', text: 'banana banana', then: { at: t + 4.2, action: 'say', text: word } };
        } else {
          // shy: stay silent, answer only after the second prompt
          this.pending = { at: t + 13.5, action: 'say', text: word };
        }
        console.log('[QA] ' + JSON.stringify({ sim: 'plan', ev: ev.id, phase: ev.phase ?? null, word, roll: +roll.toFixed(2) }));
      }
    }

    if (this.pending && t >= this.pending.at) {
      const p = this.pending;
      this.pending = p.then ?? null;
      if (p.action === 'say') {
        this.meter.poke(0.8);
        this.speech.injectUtterance(p.text);
      } else if (p.action === 'voice') {
        this.meter.poke(0.95);
        this.meter.voiceHold = 0.5;
      }
    }
  }
}
