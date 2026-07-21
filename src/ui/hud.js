// DOM game HUD: clue cards, listening meter, praise bursts, progress trail,
// sticker tray, narrator captions. Big, chunky, readable-by-a-4-year-old.

const CSS = `
.hud-root { position: fixed; inset: 0; pointer-events: none; font-family: 'Baloo 2', 'Comic Sans MS', sans-serif; overflow: hidden; }
.clue-wrap { position: fixed; left: 0; right: 0; bottom: 6vh; display: flex; justify-content: center; gap: 4vw; align-items: flex-end; }
.clue-card {
  background: rgba(255,253,247,0.96); border: 3px solid #e8dcc2; border-radius: 26px;
  padding: 16px 26px 12px; text-align: center; min-width: 150px;
  box-shadow: 0 10px 30px rgba(40,40,60,0.25);
  transform: translateY(30px) scale(0.8); opacity: 0; transition: all 0.35s cubic-bezier(.2,1.6,.4,1);
}
.clue-card.show { transform: translateY(0) scale(1); opacity: 1; }
.clue-card.correct { border-color: #7fc16e; background: #f0fae8; transform: scale(1.12); }
.clue-card.dim { opacity: 0.35; transform: scale(0.9); }
.clue-card .arrow { font-size: 26px; color: #4a7ab5; font-weight: 700; }
.clue-card .glyph { font-size: 64px; line-height: 1.15; }
.clue-card .word { font-size: 40px; font-weight: 700; color: #35313f; letter-spacing: 2px; line-height: 1.05; }
.clue-card .hint { font-size: 16px; color: #a89f8d; font-weight: 500; }
.clue-card.stop-card .word { color: #c03a2e; }
.clue-card.go-card .word { color: #3d8c4a; }
.clue-single { position: fixed; left: 50%; transform: translateX(-50%); bottom: 6vh; }
.mic-pill {
  position: fixed; left: 50%; transform: translateX(-50%); bottom: 1.2vh;
  background: rgba(255,255,255,0.92); border-radius: 999px; padding: 8px 18px;
  display: flex; align-items: center; gap: 4px; box-shadow: 0 4px 14px rgba(40,40,60,0.18);
}
.mic-pill .dot { font-size: 20px; }
.mic-pill .bar { width: 5px; border-radius: 3px; background: #d4537e; height: 6px; transition: height 0.08s; }
.praise {
  position: fixed; left: 50%; top: 30%; transform: translate(-50%,-50%) scale(0.5); opacity: 0;
  font-size: 64px; font-weight: 700; color: #fff; text-shadow: 0 4px 0 rgba(180,90,40,0.45), 0 8px 30px rgba(0,0,0,0.3);
  transition: all 0.3s cubic-bezier(.2,1.8,.4,1); pointer-events: none;
}
.praise.show { transform: translate(-50%,-50%) scale(1); opacity: 1; }
.trail {
  position: fixed; top: 2.4vh; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 0; background: rgba(255,255,255,0.55);
  border-radius: 999px; padding: 8px 18px; backdrop-filter: blur(6px);
}
.trail .seg { width: 9vw; max-width: 92px; height: 7px; border-radius: 4px; background: #d8d2c2; margin: 0 2px; position: relative; overflow: visible; }
.trail .seg .fill { height: 100%; width: 0%; border-radius: 4px; background: linear-gradient(90deg,#f291b4,#f2b035); }
.trail .chapter-dot { font-size: 22px; filter: grayscale(0.8) opacity(0.6); transition: all 0.4s; }
.trail .chapter-dot.active { filter: none; transform: scale(1.25); }
.trail .rider-icon { position: absolute; top: -17px; font-size: 24px; margin-left: -12px; transition: left 0.3s linear; }
.stickers {
  position: fixed; right: 1.6vw; top: 10vh; display: flex; flex-direction: column; gap: 6px;
}
.stickers .stk {
  width: 52px; height: 52px; background: #fffdf7; border-radius: 50%; border: 3px solid #f2c035;
  display: flex; align-items: center; justify-content: center; font-size: 28px;
  box-shadow: 0 4px 10px rgba(40,40,60,0.2); animation: stk-pop 0.5s cubic-bezier(.2,1.8,.4,1);
}
@keyframes stk-pop { 0% { transform: scale(0) rotate(-40deg); } 100% { transform: scale(1) rotate(0); } }
.caption {
  position: fixed; left: 50%; transform: translateX(-50%); top: 9vh;
  background: rgba(50,46,60,0.72); color: #fff; font-size: 22px; font-weight: 600;
  padding: 8px 22px; border-radius: 999px; opacity: 0; transition: opacity 0.3s;
}
.caption.show { opacity: 1; }
.encourage {
  position: fixed; left: 50%; transform: translateX(-50%); bottom: 24vh;
  font-size: 30px; font-weight: 700; color: #fff; text-shadow: 0 3px 0 rgba(90,80,120,0.5);
  opacity: 0; transition: opacity 0.4s;
}
.encourage.show { opacity: 1; animation: bounce 1s infinite; }
@keyframes bounce { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-8px); } }
.big-flash { position: fixed; inset: 0; background: radial-gradient(circle, rgba(255,244,200,0.5), transparent 70%); opacity: 0; transition: opacity 0.2s; }
.big-flash.show { opacity: 1; }
`;

const CHAPTER_ICONS = ['🏠', '🌳', '🍎', '🌊', '🏙️', '🛝'];

export class Hud {
  constructor(root) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.el = document.createElement('div');
    this.el.className = 'hud-root';
    root.appendChild(this.el);

    this.trail = document.createElement('div');
    this.trail.className = 'trail';
    this.segs = [];
    const N = CHAPTER_ICONS.length;
    for (let i = 0; i < N; i++) {
      const dot = document.createElement('span');
      dot.className = 'chapter-dot';
      dot.textContent = CHAPTER_ICONS[i];
      this.trail.appendChild(dot);
      if (i < N - 1) {
        const seg = document.createElement('div');
        seg.className = 'seg';
        const fill = document.createElement('div');
        fill.className = 'fill';
        seg.appendChild(fill);
        this.trail.appendChild(seg);
        this.segs.push(fill);
      }
    }
    const finalDot = document.createElement('span');
    finalDot.className = 'chapter-dot';
    finalDot.textContent = '🎉';
    this.trail.appendChild(finalDot);
    this.dots = [...this.trail.querySelectorAll('.chapter-dot')];
    this.el.appendChild(this.trail);

    this.clueWrap = document.createElement('div');
    this.clueWrap.className = 'clue-wrap';
    this.el.appendChild(this.clueWrap);

    this.micPill = document.createElement('div');
    this.micPill.className = 'mic-pill';
    this.micPill.innerHTML = '<span class="dot">🎤</span>';
    this.bars = [];
    for (let i = 0; i < 7; i++) {
      const b = document.createElement('div');
      b.className = 'bar';
      this.micPill.appendChild(b);
      this.bars.push(b);
    }
    this.el.appendChild(this.micPill);

    this.praiseEl = document.createElement('div');
    this.praiseEl.className = 'praise';
    this.el.appendChild(this.praiseEl);

    this.stickerTray = document.createElement('div');
    this.stickerTray.className = 'stickers';
    this.el.appendChild(this.stickerTray);

    this.captionEl = document.createElement('div');
    this.captionEl.className = 'caption';
    this.el.appendChild(this.captionEl);

    this.encourageEl = document.createElement('div');
    this.encourageEl.className = 'encourage';
    this.el.appendChild(this.encourageEl);

    this.flash = document.createElement('div');
    this.flash.className = 'big-flash';
    this.el.appendChild(this.flash);

    this.cards = [];
  }

  // options: [{clue, side: 'left'|'right'|'center', kind}]
  showCards(options) {
    this.clearCards();
    for (const opt of options) {
      const card = document.createElement('div');
      card.className = 'clue-card';
      if (opt.kind === 'stop') card.classList.add('stop-card');
      if (opt.kind === 'go') card.classList.add('go-card');
      const arrow = opt.side === 'left' ? '⬅' : opt.side === 'right' ? '➡' : '';
      card.innerHTML = `
        ${arrow ? `<div class="arrow">${arrow}</div>` : ''}
        <div class="glyph">${opt.clue.glyph}</div>
        <div class="word">${opt.clue.label}</div>
        ${opt.clue.hint ? `<div class="hint">say “${opt.clue.hint}”</div>` : '<div class="hint">say it out loud!</div>'}
      `;
      this.clueWrap.appendChild(card);
      requestAnimationFrame(() => card.classList.add('show'));
      this.cards.push({ el: card, id: opt.clue.id });
    }
  }

  resolveCards(correctId) {
    for (const c of this.cards) {
      c.el.classList.add(c.id === correctId ? 'correct' : 'dim');
    }
    setTimeout(() => this.clearCards(), 750);
  }

  clearCards() {
    for (const c of this.cards) c.el.remove();
    this.cards = [];
  }

  praise(text) {
    this.praiseEl.textContent = text;
    this.praiseEl.classList.add('show');
    clearTimeout(this._praiseT);
    this._praiseT = setTimeout(() => this.praiseEl.classList.remove('show'), 1300);
  }

  encourage(text) {
    if (!text) { this.encourageEl.classList.remove('show'); return; }
    this.encourageEl.textContent = text;
    this.encourageEl.classList.add('show');
  }

  caption(text, ms = 3200) {
    this.captionEl.textContent = text;
    this.captionEl.classList.add('show');
    clearTimeout(this._capT);
    this._capT = setTimeout(() => this.captionEl.classList.remove('show'), ms);
  }

  addSticker(glyph) {
    const s = document.createElement('div');
    s.className = 'stk';
    s.textContent = glyph;
    this.stickerTray.appendChild(s);
    while (this.stickerTray.children.length > 8) this.stickerTray.firstChild.remove();
  }

  flashScreen() {
    this.flash.classList.add('show');
    setTimeout(() => this.flash.classList.remove('show'), 350);
  }

  // brief arrow acknowledging a free "left"/"right" steer command
  steerPing(dir) {
    if (!this.pingEl) {
      this.pingEl = document.createElement('div');
      this.pingEl.style.cssText = 'position:fixed;top:46%;font-size:64px;font-weight:700;color:#fff;text-shadow:0 4px 0 rgba(70,110,180,0.6),0 8px 24px rgba(0,0,0,0.3);transition:opacity 0.25s;opacity:0;pointer-events:none;';
      this.el.appendChild(this.pingEl);
    }
    this.pingEl.textContent = dir === 'left' ? '⬅' : '➡';
    this.pingEl.style.left = dir === 'left' ? '12vw' : 'auto';
    this.pingEl.style.right = dir === 'left' ? 'auto' : '12vw';
    this.pingEl.style.opacity = 1;
    clearTimeout(this._pingT);
    this._pingT = setTimeout(() => { this.pingEl.style.opacity = 0; }, 650);
  }

  setProgress(frac, chapterIndex) {
    const per = 1 / Math.max(1, this.segs.length);
    this.segs.forEach((fill, i) => {
      const local = (frac - i * per) / per;
      fill.style.width = `${Math.round(Math.max(0, Math.min(1, local)) * 100)}%`;
    });
    this.dots.forEach((d, i) => d.classList.toggle('active', i === Math.min(chapterIndex, 5)));
  }

  setMicLevel(level, listening) {
    const shape = [0.4, 0.7, 1, 0.85, 1, 0.65, 0.45];
    this.bars.forEach((b, i) => {
      const h = 5 + level * 26 * shape[i] * (0.7 + Math.random() * 0.5);
      b.style.height = `${listening ? h : 4}px`;
      b.style.background = listening ? '#d4537e' : '#c8c2b6';
    });
  }
}
