import * as THREE from 'three';
import { Rider } from '../character/rider.js';
import { matchWord } from '../speech/matcher.js';

// Start flow: title → pick your ride → pick a color → pick a pace → mic
// check → countdown. Each step floats over a live 3D preview of Rae and
// her ride at the roadside. Ends with the choices + a ready mic.

const COLORS = [
  { id: 'pink', hex: 0xf291b4, css: '#f291b4' },
  { id: 'sky', hex: 0x6fb7ea, css: '#6fb7ea' },
  { id: 'white', hex: 0xf4f4f0, css: '#f4f4f0' },
  { id: 'mint', hex: 0x8fd9b6, css: '#8fd9b6' },
  { id: 'butter', hex: 0xffd166, css: '#ffd166' },
  { id: 'lilac', hex: 0xb9a3e8, css: '#b9a3e8' },
];

const CSS = `
.start-root { position: fixed; inset: 0; font-family: 'Baloo 2', sans-serif; pointer-events: none; }
.start-root * { pointer-events: auto; }
.title-wrap { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2vh; background: radial-gradient(circle at 50% 70%, rgba(255,250,240,0), rgba(70,60,90,0.24)); }
.game-title { font-size: clamp(44px, 9vw, 96px); font-weight: 700; color: #fff; text-shadow: 0 5px 0 #d4537e, 0 12px 34px rgba(60,40,80,0.45); letter-spacing: 2px; transform: rotate(-2deg); }
.game-sub { font-size: clamp(16px, 2.6vw, 26px); color: #fff; text-shadow: 0 2px 8px rgba(60,40,80,0.6); font-weight: 600; }
.big-btn { margin-top: 2vh; font-family: inherit; font-size: clamp(20px, 3vw, 30px); font-weight: 700; color: #6b3350; background: linear-gradient(180deg, #ffe9f2, #ffc9de); border: none; border-radius: 999px; padding: 14px 52px; cursor: pointer; box-shadow: 0 8px 0 #d4537e, 0 14px 30px rgba(60,40,80,0.35); transition: transform 0.12s; }
.big-btn:active { transform: translateY(5px); box-shadow: 0 3px 0 #d4537e; }
.step-wrap { position: fixed; left: 0; right: 0; bottom: 4vh; display: flex; flex-direction: column; align-items: center; gap: 1.6vh; }
.step-q { font-size: clamp(22px, 3.6vw, 36px); font-weight: 700; color: #fff; text-shadow: 0 3px 0 rgba(120,80,120,0.55), 0 8px 22px rgba(0,0,0,0.3); }
.opt-row { display: flex; gap: 2vw; }
.opt-card { font-family: inherit; background: rgba(255,253,247,0.95); border: 4px solid #e8dcc2; border-radius: 24px; padding: 14px 26px; text-align: center; cursor: pointer; min-width: 130px; transition: transform 0.15s, border-color 0.15s; }
.opt-card:hover { transform: translateY(-5px) scale(1.04); }
.opt-card.sel { border-color: #d4537e; background: #fff0f6; }
.opt-card .big { font-size: clamp(38px, 6vw, 60px); line-height: 1.1; }
.opt-card .lbl { font-size: clamp(16px, 2.2vw, 22px); font-weight: 700; color: #4a4453; }
.opt-card .sub { font-size: 13px; color: #a89f8d; font-weight: 600; }
.swatch-row { display: flex; gap: 1.4vw; }
.swatch { width: clamp(48px, 6.4vw, 66px); height: clamp(48px, 6.4vw, 66px); border-radius: 50%; border: 5px solid rgba(255,255,255,0.85); cursor: pointer; transition: transform 0.15s, border-color 0.15s; box-shadow: 0 6px 16px rgba(50,40,70,0.3); }
.swatch:hover { transform: scale(1.12); }
.swatch.sel { border-color: #4a4453; transform: scale(1.18); }
.mic-check { display: flex; flex-direction: column; align-items: center; gap: 1.2vh; background: rgba(255,253,247,0.96); border-radius: 28px; padding: 22px 44px; box-shadow: 0 12px 40px rgba(50,40,70,0.35); }
.mic-word { font-size: clamp(40px, 7vw, 72px); font-weight: 700; color: #35313f; }
.mic-bars { display: flex; gap: 5px; align-items: center; height: 40px; }
.mic-bars .bar { width: 7px; border-radius: 4px; background: #d4537e; height: 8px; transition: height 0.08s; }
.mic-status { min-height: 22px; font-size: 16px; color: #6b6353; font-weight: 700; }
.mic-start, .mic-skip { font-family: inherit; font-size: 16px; font-weight: 700; color: #6b3350; background: #ffe9f2; border: 2px solid #efb7cc; border-radius: 999px; padding: 8px 18px; cursor: pointer; }
.mic-start { font-size: 19px; padding: 11px 24px; }
.mic-start:disabled { opacity: 0.58; cursor: wait; }
.mic-start[hidden], .mic-skip[hidden] { display: none; }
.mic-note { font-size: 15px; color: #a89f8d; font-weight: 600; }
.count-num { position: fixed; left: 50%; top: 42%; transform: translate(-50%,-50%); font-size: clamp(90px, 20vw, 200px); font-weight: 700; color: #fff; text-shadow: 0 6px 0 #d4537e, 0 16px 44px rgba(60,40,80,0.5); animation: count-pop 0.9s ease-out; }
@keyframes count-pop { 0% { transform: translate(-50%,-50%) scale(0.3); opacity: 0; } 25% { transform: translate(-50%,-50%) scale(1.15); opacity: 1; } 100% { transform: translate(-50%,-50%) scale(1); opacity: 0.9; } }
.end-book { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(60,50,80,0.4); }
.book-card { background: #fffdf7; border-radius: 34px; padding: 4vh 5vw; text-align: center; box-shadow: 0 24px 70px rgba(40,30,60,0.5); }
.book-title { font-size: clamp(34px, 6vw, 60px); font-weight: 700; color: #d4537e; }
.book-sub { font-size: clamp(16px, 2.4vw, 24px); color: #6b6353; font-weight: 600; margin-bottom: 2vh; }
.book-stickers { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; max-width: 480px; margin: 0 auto 3vh; }
.book-stickers .stk2 { width: 64px; height: 64px; border-radius: 50%; background: #fff; border: 3px solid #f2c035; display: flex; align-items: center; justify-content: center; font-size: 34px; box-shadow: 0 5px 12px rgba(60,50,40,0.25); animation: stk-pop 0.5s cubic-bezier(.2,1.8,.4,1) backwards; }
`;

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
}

export class StartFlow {
  constructor({ world, speech, meter, narrator, music, sfx, onDone }) {
    this.world = world;
    this.speech = speech;
    this.meter = meter;
    this.narrator = narrator;
    this.music = music;
    this.sfx = sfx;
    this.onDone = onDone;
    this.choice = { vehicle: 'bike', color: COLORS[0], pace: 'quick' };

    ensureStyles();
    this.root = document.createElement('div');
    this.root.className = 'start-root';
    document.getElementById('ui').appendChild(this.root);

    // pretty near-field backdrop for the menus without the full world cost
    this.world.terrain.ensureRange(0, 130);
    this.world.grass.ensureRange(0, 90);

    this.#preview();
    this.#stepTitle();
  }

  // 3D preview rider at the route start, slow orbit camera
  #preview() {
    const r = this.world.route;
    this.previewPos = r.lateral(7, -0.4, r.yAt(7) + 0.03, new THREE.Vector3());
    this.previewYaw = Math.atan2(r.dirAt(7).x, r.dirAt(7).z);
    this.#buildPreviewRider();
    this.orbitT = 2.4;
    this.camTick = (dt, t) => {
      this.orbitT += dt * 0.12;
      const cam = this.world.engine.camera;
      const p = this.previewPos;
      cam.position.set(
        p.x + Math.cos(this.orbitT) * 3.3,
        p.y + 1.15 + Math.sin(t * 0.4) * 0.06,
        p.z + Math.sin(this.orbitT) * 3.3,
      );
      cam.lookAt(p.x, p.y + 0.55, p.z);
      if (this.previewRider) {
        this.previewRider.update(dt, { speed: 0, steer: 0, slope: 0, state: 'ride' });
        // tiny idle life
        this.previewRider.rae.headGrp.rotation.y = Math.sin(t * 0.5) * 0.25;
      }
      this.world.sky.update(dt, p);
      this.world.timeU.value = t;
    };
    this.world.engine.onUpdate((dt, t) => this.camTick?.(dt, t));
  }

  #buildPreviewRider() {
    if (this.previewRider) this.world.engine.scene.remove(this.previewRider.group);
    this.previewRider = new Rider(this.choice.vehicle, { frameColor: this.choice.color.hex });
    this.previewRider.group.position.copy(this.previewPos);
    this.previewRider.group.rotation.y = this.previewYaw + 0.5;
    this.world.engine.scene.add(this.previewRider.group);
  }

  #clear() { this.root.innerHTML = ''; }

  #stepTitle() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('rbr_last') ?? 'null'); } catch { saved = null; }
    this.root.innerHTML = `
      <div class="title-wrap">
        <div class="game-title">Rae's Big Ride</div>
        <div class="game-sub">a talking-out-loud adventure to the playground 🛝</div>
        <button class="big-btn">Let's play!</button>
        ${saved ? '<button class="big-btn quick" style="background:linear-gradient(180deg,#fff8e0,#ffe9a8);box-shadow:0 8px 0 #d8a83c,0 14px 30px rgba(60,40,80,0.35);color:#6b5320;">Same as last time! ⚡</button>' : ''}
      </div>`;
    // Audio must never be able to block the game. If a browser refuses to
    // start a context, she still gets to ride — just quietly.
    const wake = () => {
      try {
        this.music?.start();
        this.sfx?.start();
        this.sfx?.pop();
      } catch (err) {
        console.warn('[audio] disabled:', err.message);
      }
      setTimeout(() => this.world.ensurePopulated(), 60);
    };
    this.root.querySelector('.big-btn').onclick = () => { wake(); this.#stepVehicle(); };
    const quick = this.root.querySelector('.quick');
    if (quick) {
      quick.onclick = () => {
        wake();
        this.choice.vehicle = saved.vehicle;
        this.choice.color = COLORS.find((c) => c.id === saved.colorId) ?? COLORS[0];
        this.choice.pace = saved.pace;
        this.choice.zoe = saved.zoe;
        this.#buildPreviewRider();
        this.previewRider.setColor(this.choice.color.hex);
        this.#stepMic();
      };
    }
  }

  #stepVehicle() {
    this.#clear();
    this.root.innerHTML = `
      <div class="step-wrap">
        <div class="step-q">Which one shall we ride today?</div>
        <div class="opt-row">
          <button class="opt-card" data-v="bike"><div class="big">🚲</div><div class="lbl">My bicycle</div><div class="sub">with the yellow basket</div></button>
          <button class="opt-card" data-v="scooter"><div class="big">🛴</div><div class="lbl">My scooter</div><div class="sub">three zoomy wheels</div></button>
        </div>
      </div>`;
    for (const btn of this.root.querySelectorAll('.opt-card')) {
      btn.onclick = () => {
        this.choice.vehicle = btn.dataset.v;
        this.sfx?.pop();
        this.#buildPreviewRider();
        btn.classList.add('sel');
        setTimeout(() => this.#stepColor(), 420);
      };
    }
    this.narrator?.say('Which one shall we ride today? The bicycle, or the scooter?');
  }

  #stepColor() {
    this.#clear();
    const swatches = COLORS.map((c) => `<button class="swatch" data-c="${c.id}" style="background:${c.css}"></button>`).join('');
    this.root.innerHTML = `
      <div class="step-wrap">
        <div class="step-q">Pick your favourite colour!</div>
        <div class="swatch-row">${swatches}</div>
      </div>`;
    for (const sw of this.root.querySelectorAll('.swatch')) {
      sw.onclick = () => {
        this.choice.color = COLORS.find((c) => c.id === sw.dataset.c);
        this.previewRider.setColor(this.choice.color.hex);
        this.sfx?.pop();
        sw.classList.add('sel');
        setTimeout(() => this.#stepZoe(), 300);
      };
    }
  }

  #stepZoe() {
    this.#clear();
    this.root.innerHTML = `
      <div class="step-wrap">
        <div class="step-q">Who's riding today?</div>
        <div class="opt-row">
          <button class="opt-card" data-z="0"><div class="big">👧</div><div class="lbl">Just me!</div></button>
          <button class="opt-card" data-z="1"><div class="big">👭</div><div class="lbl">Me and Zoe!</div><div class="sub">cousin Zoe on her yellow ride</div></button>
        </div>
      </div>`;
    for (const btn of this.root.querySelectorAll('.opt-card')) {
      btn.onclick = () => {
        this.choice.zoe = btn.dataset.z === '1';
        this.sfx?.pop();
        btn.classList.add('sel');
        if (this.choice.zoe) this.#previewZoe();
        setTimeout(() => this.#stepPace(), this.choice.zoe ? 650 : 300);
      };
    }
    this.narrator?.say('Who is riding today?');
  }

  #previewZoe() {
    if (this.zoePreview) return;
    this.zoePreview = new Rider(this.choice.vehicle, { frameColor: 0xf2c035, variant: 'zoe' });
    this.zoePreview.group.position.copy(this.previewPos).add(new THREE.Vector3(0.9, 0, -0.6));
    this.zoePreview.group.rotation.y = this.previewYaw + 0.35;
    this.world.engine.scene.add(this.zoePreview.group);
    const base = this.camTick;
    this.camTick = (dt, t) => {
      base?.(dt, t);
      this.zoePreview?.update(dt, { speed: 0, steer: 0, slope: 0, state: 'ride' });
    };
  }

  #stepPace() {
    this.#clear();
    this.root.innerHTML = `
      <div class="step-wrap">
        <div class="step-q">How fast shall we go?</div>
        <div class="opt-row">
          <button class="opt-card" data-p="gentle"><div class="big">🐢</div><div class="lbl">Gentle</div></button>
          <button class="opt-card" data-p="quick"><div class="big">🐇</div><div class="lbl">Quick</div></button>
          <button class="opt-card" data-p="zoomy"><div class="big">🚀</div><div class="lbl">Super zoomy</div></button>
        </div>
      </div>`;
    for (const btn of this.root.querySelectorAll('.opt-card')) {
      btn.onclick = () => {
        this.choice.pace = btn.dataset.p;
        this.sfx?.pop();
        btn.classList.add('sel');
        setTimeout(() => this.#stepMic(), 300);
      };
    }
  }

  #stepMic() {
    this.#clear();
    this._micDone = false;
    const mobile = this.speech.mobile;
    this.root.innerHTML = `
      <div class="step-wrap">
        <div class="mic-check">
          <div class="step-q" style="color:#4a4453;text-shadow:none;">Time to check your voice!</div>
          <div class="mic-word">Say “GO!”</div>
          <div class="mic-bars">${'<div class="bar"></div>'.repeat(9)}</div>
          <div class="mic-status">${mobile ? 'Tap the microphone, then say “GO”.' : 'Listening for your “GO”…'}</div>
          <button class="mic-start" ${mobile ? '' : 'hidden'} disabled>🎤 Tap to start mic</button>
          <button class="mic-skip" hidden>Mic not responding? Tap to continue</button>
          <div class="mic-note">grown-ups: allow the microphone if asked · or press Enter</div>
        </div>
      </div>`;
    const bars = [...this.root.querySelectorAll('.mic-bars .bar')];
    const shape = [0.4, 0.6, 0.85, 1, 0.9, 1, 0.8, 0.6, 0.4];
    let meterAt = performance.now();
    this.meterTick = setInterval(() => {
      const now = performance.now();
      if (this.speech.mobile) this.meter?.update(Math.min(0.1, (now - meterAt) / 1000));
      meterAt = now;
      const lv = this.meter?.level ?? 0;
      bars.forEach((b, i) => { b.style.height = `${6 + lv * 34 * shape[i] * (0.75 + Math.random() * 0.5)}px`; });
    }, 60);
    const startBtn = this.root.querySelector('.mic-start');
    const skip = this.root.querySelector('.mic-skip');
    const status = this.root.querySelector('.mic-status');
    const showFallback = (message = 'Still listening — say “GO” or tap below.') => {
      if (this._micDone) return;
      skip.hidden = false;
      status.textContent = message;
    };
    const done = () => {
      if (this._micDone) return;
      this._micDone = true;
      clearInterval(this.meterTick);
      clearTimeout(this._micHelp);
      this.sfx?.chime();
      this.#countdown();
    };
    this.micHear = ({ text, isFinal }) => {
      const hit = matchWord(text, [{ id: 'go', say: ['go'] }]);
      if (hit && (isFinal || !mobile || hit.quality === 1)) done();
    };
    this.speech.on('heard', this.micHear);
    this.speech.on('status', (next) => {
      if (this._micDone || !mobile) return;
      if (next === 'starting') {
        status.textContent = 'Starting microphone…';
      } else if (next === 'listening') {
        startBtn.hidden = true;
        status.textContent = 'Listening — say “GO” normally!';
      } else if (next === 'reconnecting') {
        status.textContent = 'Mic reconnecting — keep speaking normally…';
      }
    });
    this.speech.on('mic-blocked', () => {
      if (this._micDone) return;
      startBtn.hidden = true;
      showFallback('Microphone blocked — allow it in Chrome settings, or tap below.');
    });
    this.speech.on('error', (error) => {
      if (this._micDone || !mobile || error === 'no-speech' || error === 'aborted') return;
      status.textContent = 'Mic reconnecting — no need to shout…';
    });
    this.keyFallback = (e) => { if (e.key === 'Enter') done(); };
    window.addEventListener('keydown', this.keyFallback);
    this.meter?.start();
    skip.onclick = done;

    if (!this.speech.available) {
      startBtn.hidden = true;
      showFallback('Voice input is unavailable here — tap below to continue.');
      this.narrator?.say('The microphone is not available. A grown-up can tap to continue.');
    } else if (mobile) {
      // First permission must be requested directly from a tap. Finish the
      // spoken setup before enabling the button so the narrator cannot cancel
      // or answer the recognition session.
      startBtn.onclick = () => {
        if (this._micDone) return;
        startBtn.disabled = true;
        startBtn.textContent = '🎤 Starting…';
        status.textContent = 'Starting microphone…';
        this.speech.start({ immediate: true });
        clearTimeout(this._micHelp);
        this._micHelp = setTimeout(() => showFallback(), 8000);
      };
      Promise.resolve(this.narrator?.say('Time to check your voice. Tap the microphone, then say go.'))
        .then(() => setTimeout(() => {
          if (this._micDone || !this.speech.available) return;
          startBtn.disabled = false;
          status.textContent = 'Tap the microphone, then say “GO”.';
        }, 120));
    } else {
      this.speech.start();
      this.narrator?.say('Time to check your voice! Say... GO!');
      this._micHelp = setTimeout(() => showFallback(), 5000);
    }

    if (this.speech.simulated) setTimeout(() => this.speech.injectUtterance('go'), 1200);
  }

  #countdown() {
    this.#clear();
    window.removeEventListener('keydown', this.keyFallback);
    this.world.ensurePopulated();
    let n = 3;
    const tick = () => {
      if (n === 0) {
        this.#clear();
        this.camTick = null;
        this.world.engine.scene.remove(this.previewRider.group);
        if (this.zoePreview) this.world.engine.scene.remove(this.zoePreview.group);
        this.narrator?.say('Off we go!');
        this.onDone(this.choice);
        return;
      }
      this.root.innerHTML = `<div class="count-num">${n}</div>`;
      this.sfx?.pop();
      n--;
      setTimeout(tick, 650);
    };
    tick();
  }
}

// Coached walkthrough shown before every real ride. Big, few words, narrator
// reads each step.
// Returns a promise that resolves when the child taps "Let's ride!".
export function showWalkthrough({ narrator, sfx, mobile = false } = {}) {
  ensureStyles();
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'start-root';
    document.getElementById('ui').appendChild(root);

    const steps = [
      { glyph: '🐱', big: 'CAT', tip: 'See a word? <b>Say it out loud!</b>', say: 'When you see a word, say it out loud!' },
      ...(!mobile ? [
        { glyph: '⬅ ➡', big: '', tip: 'Say <b>“left”</b> or <b>“right”</b> to turn.', say: 'Say left, or right, to turn!' },
        { glyph: '🐢 💨', big: '', tip: 'Say <b>“slower”</b> or <b>“faster”</b> to change speed.', say: 'Say slower, or faster, to change your speed.' },
      ] : []),
      { glyph: '🔴', big: 'STOP', tip: 'At a red light, say <b>“stop”</b>. Green means <b>“go!”</b>', say: 'At a red light say stop. Green means go!' },
    ];
    let i = 0;

    const render = () => {
      const s = steps[i];
      root.innerHTML = `
        <div class="title-wrap" style="background:rgba(60,50,80,0.5);">
          <div style="background:#fffdf7;border-radius:28px;padding:26px 34px 22px;text-align:center;max-width:360px;width:88%;box-shadow:0 20px 60px rgba(40,30,60,0.45);">
            <div style="font-size:15px;font-weight:700;color:#a89474;letter-spacing:1px;">HOW TO PLAY ${i + 1}/${steps.length}</div>
            <div style="font-size:74px;line-height:1.15;margin:10px 0 2px;">${s.glyph}</div>
            ${s.big ? `<div style="font-size:40px;font-weight:700;color:#35313f;letter-spacing:2px;">${s.big}</div>` : ''}
            <div style="font-size:21px;color:#4a4453;font-weight:600;margin:12px 0 20px;line-height:1.4;">${s.tip}</div>
            <button id="wt-next" style="font-family:inherit;font-size:24px;font-weight:700;color:#6b3350;background:linear-gradient(180deg,#ffe9f2,#ffc9de);border:none;border-radius:999px;padding:12px 40px;cursor:pointer;box-shadow:0 7px 0 #d4537e;">
              ${i < steps.length - 1 ? 'Next ▸' : "Let's ride! 🚲"}
            </button>
            <div style="font-size:12px;color:#a89f8d;margin-top:12px;">a grown-up can tap for her</div>
          </div>
        </div>`;
      // Instructions are VISUAL ONLY. Reading each step aloud queued up a
      // backlog of speech that kept playing (and kept the mic muted) straight
      // into the ride, jamming the first couple of clue cards.
      root.querySelector('#wt-next').onclick = () => {
        sfx?.pop();
        i++;
        if (i < steps.length) render();
        else { root.remove(); resolve(); }
      };
    };
    render();
  });
}

export function showStickerBook({ stickers, onAgain }) {
  ensureStyles();
  const root = document.createElement('div');
  root.className = 'start-root';
  document.getElementById('ui').appendChild(root);
  const stks = stickers.map((g, i) => `<div class="stk2" style="animation-delay:${i * 0.12}s">${g}</div>`).join('');
  root.innerHTML = `
    <div class="end-book">
      <div class="book-card">
        <div class="book-title">You did it, Rae! 🎉</div>
        <div class="book-sub">Look at all the stickers you collected today:</div>
        <div class="book-stickers">${stks.length ? stks : '<div class="book-sub">🌟</div>'}</div>
        <button class="big-btn">Ride again!</button>
      </div>
    </div>`;
  root.querySelector('.big-btn').onclick = onAgain;
  return root;
}
