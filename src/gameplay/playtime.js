import * as THREE from 'three';

// After she arrives, Rae doesn't just watch a screen — she gets to PLAY.
// She rolls off the road into the playground and can call out (or tap) fun
// actions — jump, spin, dance, ring the bell — as many times as she likes,
// until a grown-up (or she) taps "All done". Then the sticker book.

const ACTIONS = [
  { id: 'jump', label: 'JUMP', glyph: '🤸', say: ['jump', 'up', 'hop', 'bounce'] },
  { id: 'spin', label: 'SPIN', glyph: '🌀', say: ['spin', 'turn', 'round', 'twirl'] },
  { id: 'dance', label: 'DANCE', glyph: '🎉', say: ['dance', 'wheee', 'yay', 'party'] },
  { id: 'bell', label: 'RING', glyph: '🔔', say: ['bell', 'ring', 'ring ring'] },
];

const CSS = `
.pt-root { position: fixed; inset: 0; pointer-events: none; font-family: 'Baloo 2', sans-serif; }
.pt-title { position: fixed; top: 5vh; left: 50%; transform: translateX(-50%); text-align: center;
  font-size: clamp(26px, 5vw, 46px); font-weight: 700; color: #fff; text-shadow: 0 3px 0 #d4537e, 0 8px 24px rgba(60,40,80,.45); }
.pt-sub { font-size: clamp(14px, 2.4vw, 20px); font-weight: 600; color: #fff; text-shadow: 0 2px 8px rgba(60,40,80,.6); margin-top: 4px; }
.pt-actions { position: fixed; left: 0; right: 0; bottom: 5vh; display: flex; justify-content: center; gap: 2.2vw; flex-wrap: wrap; }
.pt-card { pointer-events: auto; background: rgba(255,253,247,.96); border: 3px solid #e8dcc2; border-radius: 22px;
  padding: 12px 20px 8px; text-align: center; min-width: 104px; cursor: pointer; transition: transform .12s; }
.pt-card:hover { transform: translateY(-5px) scale(1.05); }
.pt-card:active { transform: translateY(2px) scale(.98); }
.pt-card .g { font-size: clamp(38px, 6vw, 54px); line-height: 1.1; }
.pt-card .l { font-size: clamp(15px, 2.2vw, 20px); font-weight: 700; color: #4a4453; letter-spacing: 1px; }
.pt-done { pointer-events: auto; position: fixed; top: 3vh; right: 3vw; font-family: inherit;
  font-size: clamp(15px, 2.2vw, 19px); font-weight: 700; color: #6b3350; background: linear-gradient(180deg,#ffe9f2,#ffc9de);
  border: none; border-radius: 999px; padding: 10px 24px; cursor: pointer; box-shadow: 0 5px 0 #d4537e; }
`;

export class Playtime {
  constructor({ engine, player, world, speech, sfx, narrator, hud, confetti, uiRoot, onFinish }) {
    Object.assign(this, { engine, player, world, speech, sfx, narrator, hud, confetti, uiRoot, onFinish });
    this.t = 0;
    this.action = null;
    this.actionT = 0;
    this.orbit = 0;
    this.baseY = 0;
    this.baseYaw = 0;
    this.spinExtra = 0;
    this.jumpY = 0;
    this.finished = false;
  }

  start() {
    const r = this.world.route;
    const L = this.world.L;
    // roll Rae off the road into the playground and face outward
    this.spot = r.lateral(L - 15, -7.5, r.yAt(L - 15) + 0.02, new THREE.Vector3());
    this.player.rider.group.position.copy(this.spot);
    this.baseYaw = Math.atan2(r.rightAt(L - 15).x, r.rightAt(L - 15).z) + Math.PI; // face the road/camera
    this.player.rider.group.rotation.set(0, this.baseYaw, 0);
    this.baseY = this.spot.y;

    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    this.el = document.createElement('div'); this.el.className = 'pt-root';
    this.el.innerHTML = `
      <div class="pt-title">🎉 You made it to the playground!<div class="pt-sub">Say or tap — jump, spin, dance, ring the bell!</div></div>
      <button class="pt-done">All done 🎀</button>
      <div class="pt-actions">${ACTIONS.map((a) => `<div class="pt-card" data-a="${a.id}"><div class="g">${a.glyph}</div><div class="l">${a.label}</div></div>`).join('')}</div>`;
    this.uiRoot.appendChild(this.el);
    for (const card of this.el.querySelectorAll('.pt-card')) {
      card.onclick = () => this.#do(card.dataset.a);
    }
    this.el.querySelector('.pt-done').onclick = () => this.end();

    // listen for the action words (recognition keeps running)
    this.heardFn = ({ text }) => {
      if (this.finished) return;
      const hit = matchAny(text);
      if (hit) this.#do(hit);
    };
    this.speech.on('heard', this.heardFn);
    this.narrator.say('You made it! Let’s play! Say jump, spin, or dance!');
    this.hud?.clearCards?.();
  }

  #do(id) {
    if (this.finished) return;
    this.action = id; this.actionT = 0;
    this.sfx?.pop?.();
    if (id === 'jump') { this.hud?.praise?.('🤸 Jump!'); }
    else if (id === 'spin') { this.hud?.praise?.('🌀 Spin!'); this.spinFrom = this.player.rider.group.rotation.y; }
    else if (id === 'dance') { this.hud?.praise?.('🎉 Dance!'); this.confetti?.burst?.(this.player.rider.group.position); }
    else if (id === 'bell') { this.hud?.praise?.('🔔 Ring ring!'); this.onBell?.(); }
  }

  update(dt, t) {
    if (this.finished) return;
    this.t += dt;
    const g = this.player.rider.group;
    // keep a lively idle pose (legs/arms alive) without moving her along the route
    this.player.rider.update(dt, { speed: 0.4, steer: 0, slope: 0, state: this.action === 'dance' ? 'celebrate' : 'ride' });

    // run the current action for ~2.4s then settle
    let hop = Math.sin(this.t * 3) * 0.02; // gentle idle bob
    if (this.action) {
      this.actionT += dt;
      const k = this.actionT;
      if (this.action === 'jump') hop = Math.abs(Math.sin(k * 6)) * 0.4;
      else if (this.action === 'spin') g.rotation.y = this.spinFrom + Math.min(1, k / 1.6) * Math.PI * 2;
      else if (this.action === 'dance') hop = Math.abs(Math.sin(k * 7)) * 0.12;
      if (k > 2.4) { this.action = null; g.rotation.y = this.baseYaw; }
    }
    g.position.set(this.spot.x, this.baseY + hop, this.spot.z);

    // slow, joyful orbit around her
    this.orbit += dt * 0.28;
    const cam = this.engine.camera;
    cam.position.set(
      this.spot.x + Math.cos(this.orbit) * 4.4,
      this.baseY + 1.9 + Math.sin(t * 0.5) * 0.15,
      this.spot.z + Math.sin(this.orbit) * 4.4,
    );
    cam.lookAt(this.spot.x, this.baseY + 0.6, this.spot.z);
    cam.fov += (52 - cam.fov) * Math.min(1, dt * 2);
    cam.updateProjectionMatrix();

    // keep the world's props (plushies, kids, balloons) animating around her
    this.world.update(dt, t, this.player.s, this.spot);
  }

  end() {
    if (this.finished) return;
    this.finished = true;
    this.el.remove();
    this.onFinish?.();
  }
}

// lightweight matcher just for the four play words (avoids importing the full
// director matcher here; child-speech variants included in ACTIONS.say)
function matchAny(text) {
  const t = (text || '').toLowerCase().replace(/[^a-z\s]/g, ' ');
  for (const a of ACTIONS) {
    for (const w of a.say) {
      if (t.includes(w)) return a.id;
    }
  }
  return null;
}
