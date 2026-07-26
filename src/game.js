import { GameWorld } from './world/game-world.js';
import { Player } from './gameplay/player.js';
import { Director } from './gameplay/director.js';
import { SpeechManager } from './speech/recognizer.js';
import { VoiceMeter } from './speech/voiceMeter.js';
import { Narrator } from './speech/narrator.js';
import { SimDriver } from './speech/simInput.js';
import { Hud } from './ui/hud.js';
import { StartFlow, showStickerBook, showWalkthrough } from './ui/screens.js';
import { Music } from './audio/music.js';
import { Sfx } from './audio/sfx.js';
import { Companion } from './gameplay/companion.js';
import { Playtime } from './gameplay/playtime.js';

// The whole game: start flow → the ride → sticker book.
// QA: ?sim=1 fake voice · ?auto=1 fast unattended run (+ ?interval=1 in
// throttled embedded panes) · ?skipmenu=1 jump straight in.

const COLORS = { pink: 0xf291b4, sky: 0x6fb7ea, white: 0xf4f4f0, mint: 0x8fd9b6, butter: 0xffd166, lilac: 0xb9a3e8 };

export function startGame() {
  const params = new URLSearchParams(location.search);
  const sim = params.has('sim') || params.has('auto');
  const auto = params.has('auto');
  const skipMenus = sim || params.has('skipmenu');

  const pace0 = params.get('pace') ?? 'quick';
  const world = new GameWorld({ pace: pace0, params, deferPopulate: !skipMenus });
  const { engine, route } = world;

  const speech = new SpeechManager({ lang: 'en-SG' });
  const meter = new VoiceMeter();
  const narrator = new Narrator();
  const music = new Music();
  const sfx = new Sfx();

  // Mobile speakers can feed the modelled answer back into recognition, so
  // suspend those short sessions while the helper talks. Desktop keeps its
  // continuous recognizer alive to avoid dropping an answer during the prompt.
  if (speech.mobile) {
    let narratorRelease = null;
    narrator.on('start', () => {
      clearTimeout(narratorRelease);
      speech.hold('narrator');
      // Browser speech synthesis occasionally omits its completion callback.
      // None of the helper lines lasts this long, so fail open rather than
      // leaving the microphone held forever.
      narratorRelease = setTimeout(() => speech.release('narrator'), 8000);
    });
    narrator.on('end', () => {
      clearTimeout(narratorRelease);
      narratorRelease = setTimeout(() => speech.release('narrator'), 80);
    });
  }

  if (speech.mobile) {
    speech.on('activity', () => meter.poke(0.45));
    // Visual feedback only. A generic sound must never resolve an answer.
    speech.on('voice', () => meter.poke(0.72));
  }
  if (sim) speech.useSimulation();
  if (auto) { narrator.muted = true; }

  const uiRoot = document.getElementById('ui');

  const beginRide = (choice) => {
    world.ensurePopulated();
    try {
      localStorage.setItem('rbr_last', JSON.stringify({
        vehicle: choice.vehicle, colorId: choice.colorId ?? 'white',
        pace: choice.pace, zoe: !!choice.zoe,
      }));
    } catch { /* private mode */ }

    const player = new Player(engine, route, {
      vehicle: choice.vehicle,
      frameColor: choice.colorHex,
      pace: choice.pace,
    });
    const zoe = (choice.zoe || params.has('zoe'))
      ? new Companion(engine, route, { vehicle: choice.vehicle })
      : null;

    const hud = new Hud(uiRoot);
    const director = new Director({
      world, player, speech, meter, narrator, hud, sfx,
      onListen: (active) => music.setListening(active),
    });
    director.onBell = () => sfx.bell();

    if (params.has('jump')) {
      player.s = parseFloat(params.get('jump'));
      if (zoe) zoe.s = Math.max(0.5, player.s - 0.3);
      for (const e of director.events) {
        if (e.s < player.s - 20 && e.kind !== 'arrival') { e.done = true; e.outcome = 'skipped-by-jump'; }
      }
    }

    const simDriver = sim ? new SimDriver({
      director, speech, meter,
      seed: parseInt(params.get('simseed') ?? '42', 10),
      cooperative: 0.85,
    }) : null;

    if (auto) engine.timeScale = parseFloat(params.get('ts') ?? '6');

    // Coached walkthrough appears before every real ride on desktop and
    // mobile. QA automation can still opt out with ?notut=1.
    // Flush any helper speech still queued from the menus/walkthrough before we
    // start listening, so no leftover narration plays on into the ride and gets
    // picked up by the live desktop mic (which would false-fire the first cards).
    const beginListening = () => {
      if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch { /* noop */ } }
      narrator.speaking = false;
      // The walkthrough button is a fresh user gesture, so mobile can begin
      // listening immediately instead of deferring its browser handshake.
      speech.start({ immediate: speech.mobile });
    };
    const runWalkthrough = () => {
      engine.setPaused(true);
      speech.pause();
      return showWalkthrough({ narrator, sfx, mobile: speech.mobile }).then(() => {
        engine.setPaused(false);
        beginListening();
      });
    };
    if (!sim && !params.has('notut')) runWalkthrough();
    else beginListening();

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') player.setLane(player.laneTarget - 0.8);
      if (e.key === 'ArrowRight') player.setLane(player.laneTarget + 0.8);
      if (e.key === 'Enter' && director.active?.targets?.length) {
        speech.injectUtterance(director.active.targets[0].say[0]);
      }
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); togglePause(); }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
    });

    // touch fallback: tap the left/right third of the screen to steer, tap
    // the small ⏸ button (top-left) for the menu. Voice still works too.
    const pauseBtn = document.createElement('button');
    pauseBtn.textContent = '⏸';
    pauseBtn.setAttribute('aria-label', 'Pause');
    pauseBtn.style.cssText = 'position:fixed;top:12px;left:12px;z-index:80;width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,0.82);font-size:20px;cursor:pointer;box-shadow:0 3px 10px rgba(40,30,60,0.25);';
    pauseBtn.onclick = () => togglePause();
    uiRoot.appendChild(pauseBtn);

    document.getElementById('app').addEventListener('pointerdown', (e) => {
      if (pauseEl) return;
      const x = e.clientX / window.innerWidth;
      if (x < 0.33) { player.setLane(player.laneTarget - 0.85); hud.steerPing('left'); }
      else if (x > 0.67) { player.setLane(player.laneTarget + 0.85); hud.steerPing('right'); }
    });

    // Single ESC / P / ⏸ menu — pause + all parent controls together.
    let pauseEl = null;
    const togglePause = () => {
      if (pauseEl) {
        pauseEl.remove(); pauseEl = null;
        engine.setPaused(false);
        speech.start();
        music.setListening(false);
        return;
      }
      engine.setPaused(true);
      speech.pause();
      music.setListening(true); // duck down while paused
      pauseEl = document.createElement('div');
      pauseEl.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(60,50,80,0.45);z-index:95;font-family:Baloo\\ 2,sans-serif;padding:16px;';
      const btn = (id, label, bg, shadow, color) =>
        `<button id="${id}" style="font-family:inherit;font-size:20px;font-weight:700;color:${color};background:${bg};border:none;border-radius:999px;padding:11px 30px;cursor:pointer;box-shadow:0 6px 0 ${shadow};margin:5px;">${label}</button>`;
      const slider = (id, label, min, max, step, val) =>
        `<label style="display:block;font-size:14px;color:#6b6353;font-weight:600;margin:10px 0 2px;text-align:left;">${label}</label>
         <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}" style="width:100%">`;
      pauseEl.innerHTML = `
        <div style="background:#fffdf7;border-radius:30px;padding:26px 34px;text-align:center;box-shadow:0 20px 60px rgba(40,30,60,0.45);max-width:340px;width:100%;max-height:90vh;overflow:auto;">
          <div style="font-size:38px;font-weight:700;color:#d4537e;">Paused ⏸</div>
          <div style="font-size:17px;color:#6b6353;font-weight:600;margin:4px 0 14px;">Take your time!</div>
          ${btn('pz-resume', 'Keep riding!', 'linear-gradient(180deg,#ffe9f2,#ffc9de)', '#d4537e', '#6b3350')}
          ${btn('pz-how', 'How to play 📖', 'linear-gradient(180deg,#eaf7e6,#c8ecc2)', '#4a9440', '#2c5c28')}
          ${btn('pz-restart', 'Start again 🔄', 'linear-gradient(180deg,#e6f3ff,#c2e0f7)', '#3d7ab5', '#204a6b')}
          <div style="border-top:1px solid #ece5d6;margin:16px 0 2px;padding-top:12px;">
            <div style="font-weight:700;font-size:15px;color:#a89474;text-align:left;letter-spacing:0.5px;">GROWN-UP SETTINGS</div>
            ${slider('pp-music', 'Music volume', 0, 0.4, 0.02, music.volume)}
            ${slider('pp-mic', 'Mic sensitivity', 0.6, 3.2, 0.2, meter.gain)}
            <label style="display:flex;align-items:center;gap:8px;font-size:15px;color:#6b6353;font-weight:600;margin-top:12px;text-align:left;cursor:pointer;">
              <input id="pp-narr" type="checkbox" ${narrator.muted ? '' : 'checked'} style="width:18px;height:18px;"> Helper voice
            </label>
          </div>
          <div style="font-size:12px;color:#a89f8d;margin-top:14px;line-height:1.5;">
            She can say <b>left</b>, <b>right</b>, <b>faster</b>, <b>slower</b> any time.<br>
            Grown-up keys: ⬅ ➡ steer · Enter answers the card · Esc menu.
          </div>
        </div>`;
      uiRoot.appendChild(pauseEl);
      pauseEl.querySelector('#pz-resume').onclick = togglePause;
      pauseEl.querySelector('#pz-how').onclick = () => { togglePause(); runWalkthrough(); };
      pauseEl.querySelector('#pz-restart').onclick = () => location.reload();
      pauseEl.querySelector('#pp-music').oninput = (e) => music.setVolume(parseFloat(e.target.value));
      pauseEl.querySelector('#pp-mic').oninput = (e) => { meter.gain = parseFloat(e.target.value); };
      pauseEl.querySelector('#pp-narr').onchange = (e) => {
        narrator.muted = !e.target.checked;
        if (narrator.muted && window.speechSynthesis) speechSynthesis.cancel();
      };
    };

    // finale sequencing
    let finaleStep = 0;
    let summaryDone = false;
    let playtime = null;
    const finale = () => {
      if (!director.finished) return;
      if (finaleStep === 0) {
        player.setState('slowing');
        finaleStep = 1;
      } else if (finaleStep === 1 && player.s > world.L - 7) {
        player.setState('stop');
        finaleStep = 2;
      } else if (finaleStep === 2 && player.speed < 0.1) {
        director.confetti.burst(player.pos);
        hud.flashScreen();
        sfx.chime();
        hud.praise('🎉 You did it, Rae!');
        finaleStep = 3;
        // brief arrival cheer, then she gets to PLAY in the playground
        this_setT(() => {
          playtime = new Playtime({
            engine, player, world, speech, sfx, narrator, hud,
            confetti: director.confetti, uiRoot,
            onFinish: () => showStickerBook({ stickers: director.stickers, onAgain: () => location.reload() }),
          });
          playtime.onBell = () => sfx.bell();
          playtime.start();
          if (auto) this_setT(() => playtime.end(), 4000);  // QA runs don't linger
        }, 1600);
      } else if (finaleStep === 3 && !summaryDone) {
        summaryDone = true;
        const outcomes = director.events.map((e) => ({ id: e.id, kind: e.kind, outcome: e.outcome ?? (e.done ? 'done' : 'skipped') }));
        const avgFps = engine.fps.history.length
          ? engine.fps.history.reduce((a, b) => a + b, 0) / engine.fps.history.length : 0;
        console.log('[QA] SUMMARY ' + JSON.stringify({ outcomes, avgFps: +avgFps.toFixed(1), events: outcomes.length }));
      }
    };
    const this_setT = (fn, ms) => setTimeout(fn, auto ? ms / (engine.timeScale || 1) : ms);

    const fpsEl = document.createElement('div');
    fpsEl.style.cssText = 'position:fixed;left:10px;bottom:10px;color:#fff;font:12px monospace;background:rgba(0,0,0,0.4);padding:4px 8px;border-radius:6px;z-index:50;';
    if (params.has('debug') || sim) uiRoot.appendChild(fpsEl);

    let seaside = false;
    engine.onUpdate((dt, t, rawDt) => {
      meter.update(rawDt);
      if (playtime && !playtime.finished) {
        // playtime drives Rae, the camera, and the world itself
        playtime.update(dt, t);
        finale();
        return;
      }
      player.update(dt);
      zoe?.update(dt, player);
      world.update(dt, t, player.s, player.pos);
      director.update(dt, t);
      simDriver?.update(dt, t);
      director.carUpdate?.(dt);
      finale();
      const ch = route.chapterAt(player.s).id;
      if ((ch === 'coast') !== seaside) { seaside = ch === 'coast'; sfx.setSeaside(seaside); }
      if (fpsEl.parentNode) {
        fpsEl.textContent = `${engine.fps.value.toFixed(0)} fps · s=${player.s.toFixed(0)}/${world.L} · ${(player.speed * 3.6).toFixed(0)} km/h · ${ch}${sim ? ' · sim' : ''}`;
      }
    });

    window.__dbg = { world, player, director, speech, meter };
    console.log('[QA] ride-begin ' + JSON.stringify(choice));
  };

  if (skipMenus) {
    beginRide({
      vehicle: params.get('v') === 'scooter' ? 'scooter' : 'bike',
      colorHex: COLORS[params.get('c')] ?? COLORS.white,
      colorId: params.get('c') ?? 'white',
      pace: pace0,
      zoe: params.has('zoe'),
    });
  } else {
    new StartFlow({
      world, speech, meter, narrator, music, sfx,
      onDone: (choice) => beginRide({
        vehicle: choice.vehicle,
        colorHex: choice.color.hex,
        colorId: choice.color.id,
        pace: choice.pace,
        zoe: choice.zoe,
      }),
    });
  }

  engine.start();
  console.log('[QA] game-ready');
}
