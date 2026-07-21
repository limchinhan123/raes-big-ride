import * as THREE from 'three';
import { mulberry32 } from '../core/prng.js';
import { matchWord } from '../speech/matcher.js';
import { pickPair, pickOne, resetDecks, CLUES } from './clues.js';
import { buildSleepingCat, buildPigeons, buildPuddle, buildBeachBall, buildCone, buildAuntie, buildOtterFamily } from './obstacles.js';

// The conductor: builds the interaction timeline, arms clue cards as Rae
// approaches, listens for her words, slows her gently when she's quiet, and
// never lets the ride become a test she can fail.

const V3 = () => new THREE.Vector3();

class Confetti {
  constructor(scene) {
    this.scene = scene;
    const count = 240;
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(count * 3);
    this.velocities = [];
    const colors = new Float32Array(count * 3);
    const palette = [0xf291b4, 0x6fb7ea, 0xffd166, 0x8fd9b6, 0xb9a3e8, 0xffffff];
    const C = new THREE.Color();
    for (let i = 0; i < count; i++) {
      C.setHex(palette[i % palette.length]);
      colors[i * 3] = C.r; colors[i * 3 + 1] = C.g; colors[i * 3 + 2] = C.b;
      this.velocities.push(new THREE.Vector3());
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.09, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false,
    }));
    this.points.visible = false;
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.life = 0;
  }

  burst(center) {
    this.life = 2.6;
    this.points.visible = true;
    for (let i = 0; i < this.velocities.length; i++) {
      this.positions[i * 3] = center.x;
      this.positions[i * 3 + 1] = center.y + 1.2;
      this.positions[i * 3 + 2] = center.z;
      this.velocities[i].set(
        (Math.random() - 0.5) * 4.5,
        2.5 + Math.random() * 3.5,
        (Math.random() - 0.5) * 4.5,
      );
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    if (this.life <= 0) return;
    this.life -= dt;
    if (this.life <= 0) { this.points.visible = false; return; }
    for (let i = 0; i < this.velocities.length; i++) {
      const v = this.velocities[i];
      v.y -= dt * 4.2;
      v.multiplyScalar(Math.exp(-dt * 0.6));
      this.positions[i * 3] += v.x * dt;
      this.positions[i * 3 + 1] += v.y * dt;
      this.positions[i * 3 + 2] += v.z * dt;
    }
    this.points.material.opacity = Math.min(1, this.life);
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

export class Director {
  constructor({ world, player, speech, meter, narrator, hud, sfx, onListen }) {
    this.world = world;
    this.player = player;
    this.speech = speech;
    this.meter = meter;
    this.narrator = narrator;
    this.hud = hud;
    this.sfx = sfx;
    this.stickers = [];
    this.onListen = onListen ?? (() => {});
    // random seed per play → clue order differs every ride (was fixed 510,
    // which dealt the identical sequence every time). A ?seed= param can pin
    // it for deterministic QA.
    const seedParam = new URLSearchParams(location.search).get('seed');
    this.rand = mulberry32(seedParam != null ? +seedParam : (Math.random() * 1e9) | 0);
    resetDecks();
    this.usedClues = new Set();
    this.events = [];
    this.active = null;
    this.stateTimer = 0;
    this.promptCount = 0;
    this.finished = false;
    this.confetti = new Confetti(world.engine.scene);
    this.narrated = new Set();

    this.#buildTimeline();
    this.#buildAmbientMarks();

    speech.on('heard', ({ text, isFinal }) => this.#onHeard(text, isFinal));
    meter.on('voice', () => this.#onVoice());
  }

  // ---------- timeline ----------

  #chapterRange(id) {
    const L = this.world.L;
    const ch = {
      heartland: [0.02, 0.17], connector: [0.19, 0.35], market: [0.37, 0.51],
      coast: [0.53, 0.69], city: [0.71, 0.86], finale: [0.88, 0.97],
    }[id];
    return [ch[0] * L, ch[1] * L];
  }

  #buildTimeline() {
    const L = this.world.L;
    const m = this.world.marks;
    const keepClear = [m.zebra1, m.zebra2, m.bridge, m.arch].flatMap((s) => [s]);
    const clear = (s) => keepClear.every((k) => Math.abs(k - s) > 30) &&
      this.events.every((e) => Math.abs(e.s - s) > 26);
    const place = (id, fr, entry) => {
      const [a, b] = this.#chapterRange(id);
      let s = a + fr * (b - a);
      let guard = 0;
      while (!clear(s) && guard++ < 20) s += 24;
      this.events.push({ chapter: id, s, tries: 0, shown: false, done: false, ...entry });
    };

    // forks: free choices
    for (const [ch, fr] of [
      ['heartland', 0.12], ['heartland', 0.34], ['heartland', 0.78],
      ['connector', 0.16], ['connector', 0.44], ['connector', 0.72], ['connector', 0.93],
      ['market', 0.12], ['market', 0.42], ['market', 0.72], ['market', 0.94],
      ['coast', 0.16], ['coast', 0.42], ['coast', 0.66], ['coast', 0.92],
      ['city', 0.14], ['city', 0.46], ['city', 0.78], ['city', 0.95],
      ['finale', 0.22], ['finale', 0.6],
    ]) place(ch, fr, { kind: 'fork' });

    // obstacles: steer around
    for (const [ch, fr, ob] of [
      ['heartland', 0.23, 'cat'], ['heartland', 0.46, 'cone'],
      ['heartland', 0.62, 'ball'], ['heartland', 0.9, 'puddle'],
      ['connector', 0.06, 'cat'], ['connector', 0.3, 'puddle'],
      ['connector', 0.58, 'ball'], ['connector', 0.84, 'puddle'],
      ['market', 0.26, 'auntie'], ['market', 0.55, 'cone'],
      ['market', 0.85, 'auntie'],
      ['coast', 0.3, 'ball'], ['coast', 0.54, 'cat'], ['coast', 0.8, 'cone'],
      ['city', 0.28, 'auntie'], ['city', 0.62, 'cone'], ['city', 0.9, 'puddle'],
      ['finale', 0.4, 'ball'], ['finale', 0.8, 'cat'],
    ]) place(ch, fr, { kind: 'obstacle', obstacle: ob });

    // spectacle + lights + joy
    this.events.push({ kind: 'light', s: m.zebra1, chapter: 'heartland', which: 0, tries: 0, done: false });
    this.events.push({ kind: 'light', s: m.zebra2, chapter: 'city', which: 1, tries: 0, done: false });
    place('coast', 0.72, { kind: 'otters' });
    // whee on the steepest downhill in the connector
    const [c0, c1] = this.#chapterRange('connector');
    let bestS = c0, bestSlope = 1;
    for (let s = c0; s < c1; s += 4) {
      const sl = this.world.route.slopeAt(s);
      if (sl < bestSlope) { bestSlope = sl; bestS = s; }
    }
    this.events.push({ kind: 'whee', s: bestS - 15, chapter: 'connector', tries: 0, done: false });
    this.events.push({ kind: 'arrival', s: L - 9, chapter: 'finale', tries: 0, done: false });

    this.events.sort((a, b) => a.s - b.s);
    this.events.forEach((e, i) => { e.id = `${e.kind}-${i}`; });

    // spawn obstacle/spectacle visuals now
    for (const ev of this.events) {
      if (ev.kind === 'obstacle') this.#spawnObstacle(ev);
      if (ev.kind === 'otters') this.#spawnOtters(ev);
    }
    // ambient pigeons near the mama shop
    this.pigeons = buildPigeons(9);
    const ps = this.world.marks.mamaShop + 14;
    this.pigeons.group.position.copy(this.world.route.lateral(ps, 2.1, this.world.route.yAt(ps) + 0.03, V3()));
    this.world.engine.scene.add(this.pigeons.group);
    this.pigeonsS = ps;
  }

  #spawnObstacle(ev) {
    const side = this.rand() < 0.5 ? -1 : 1;
    ev.blockedLane = side * 1.0;
    ev.safeLane = -side * 1.0;
    const builders = { cat: buildSleepingCat, puddle: buildPuddle, ball: buildBeachBall, auntie: buildAuntie, cone: buildCone };
    ev.visual = (builders[ev.obstacle] ?? buildCone)();
    const pos = this.world.route.lateral(ev.s, ev.blockedLane, this.world.route.yAt(ev.s) + 0.05, V3());
    ev.visual.group.position.copy(pos);
    const dir = this.world.route.dirAt(ev.s, V3());
    ev.visual.group.rotation.y = Math.atan2(dir.x, dir.z) + (this.rand() - 0.5) * 2;
    this.world.engine.scene.add(ev.visual.group);
  }

  #spawnOtters(ev) {
    ev.visual = buildOtterFamily();
    const pos = this.world.route.lateral(ev.s, 0, this.world.route.yAt(ev.s) + 0.04, V3());
    ev.visual.group.position.copy(pos);
    const dir = this.world.route.dirAt(ev.s, V3());
    ev.visual.group.rotation.y = Math.atan2(dir.x, dir.z);
    this.world.engine.scene.add(ev.visual.group);
  }

  #buildAmbientMarks() {
    const m = this.world.marks;
    // most sights are caption-only now — the narrator saves her voice
    this.ambient = [
      { s: m.mamaShop - 18, text: 'Look! The mama shop!' },
      { s: m.pcn[0] + 10, text: 'The park connector!' },
      { s: m.market[0] + 12, text: 'The market! So many people!', say: 'The market! Look at all the fruit!' },
      { s: m.market[1] - 40, text: 'Hawker centre — smells good!' },
      { s: this.world.coastRange[0] + 15, text: 'The sea!', say: 'Look, the sea!' },
      { s: m.bridge - 25, text: 'A big bridge!' },
      { s: this.world.marks.busStop2 + 10, text: 'The city!' },
      { s: m.arch - 30, text: 'Balloons!', say: 'The playground is near!' },
    ];
  }

  // ---------- speech ----------

  get listening() {
    return !!(this.active && (this.active.targets?.length || this.active.kind === 'whee'));
  }

  #onHeard(text, isFinal = true) {
    if (this.finished) return;
    this.meter.poke(0.65);
    const ev = this.active;
    const strictInterim = this.speech.mobile && !isFinal;

    // a waiting clue card gets first refusal on the word
    if (ev?.targets?.length) {
      const hit = matchWord(text, ev.targets);
      if (hit && (!strictInterim || hit.quality === 1)) {
        this.#resolve(ev, hit.id, 'said');
        return;
      }
    }

    // The bell stays available at any moment. Steering and speed remain
    // desktop-only: mobile recognition is reserved for the active word card.
    const freeTargets = [
      { id: 'bell', say: ['bell', 'ring ring'] },
      ...(!this.speech.mobile ? [
        { id: 'left', say: ['left'] },
        { id: 'right', say: ['right'] },
        { id: 'faster', say: ['faster', 'fast', 'speed up'] },
        { id: 'slower', say: ['slower', 'slow', 'slow down'] },
      ] : []),
    ];
    const free = matchWord(text, freeTargets);
    if (!free || (strictInterim && free.quality !== 1)) return;
    if (free.id === 'bell') {
      this.hud.praise('🔔 Ring ring!');
      this.#scatterPigeonsNear();
      this.onBell?.();
      return;
    }
    if (free.id === 'faster' || free.id === 'slower') {
      const up = free.id === 'faster';
      const p = this.player;
      p.baseSpeed = THREE.MathUtils.clamp(p.baseSpeed + (up ? 1.1 : -1.1), 2.2, 9.5);
      this.hud.praise(up ? '💨 Faster!' : '🐢 Slower!');
      this.sfx?.whoosh?.();
      console.log('[QA] ' + JSON.stringify({ speedCmd: free.id, base: +p.baseSpeed.toFixed(1) }));
      return;
    }
    const dir = free.id === 'left' ? -1 : 1;
    this.player.setLane(this.player.laneTarget + dir * 0.85);
    this.hud.steerPing(free.id);
    this.freeSteers = (this.freeSteers ?? 0) + 1;
    console.log('[QA] ' + JSON.stringify({ steer: free.id, s: Math.round(this.player.s) }));
  }

  #onVoice() {
    const ev = this.active;
    if (ev && ev.kind === 'whee' && !ev.done) this.#resolve(ev, 'wheee', 'voice');
    // a resumed shout also restarts after an auto-stop that already modeled the word
    if (ev && ev.stuckOpen && ev.tries >= 3) this.#resolve(ev, ev.targets?.[0]?.id ?? 'go', 'voice');
  }

  #scatterPigeonsNear() {
    if (Math.abs(this.player.s - this.pigeonsS) < 30) {
      this.pigeons.update(0.001, 0, 1); // force scatter trigger distance
    }
  }

  #sticker(glyph) {
    this.stickers.push(glyph);
    this.hud.addSticker(glyph);
    this.sfx?.chime();
  }

  // ---------- event lifecycle ----------

  #arm(ev) {
    this.active = ev;
    ev.shown = true;
    this.stateTimer = 0;
    this.promptCount = 0;
    const chapterClues = CLUES[ev.chapter] ? ev.chapter : 'heartland';

    if (ev.kind === 'fork') {
      const [a, b] = pickPair(chapterClues, this.rand, this.usedClues);
      ev.left = a; ev.right = b;
      ev.targets = [
        { id: a.id, say: a.say },
        { id: b.id, say: b.say },
      ];
      this.hud.showCards([
        { clue: a, side: 'left' },
        { clue: b, side: 'right' },
      ]);
    } else if (ev.kind === 'obstacle') {
      const c = pickOne(chapterClues, this.rand, this.usedClues);
      ev.clue = c;
      ev.targets = [{ id: c.id, say: c.say }];
      this.hud.showCards([{ clue: c, side: ev.safeLane < 0 ? 'left' : 'right' }]);
    } else if (ev.kind === 'light') {
      ev.phase = 'red-approach';
      this.world.trafficLights[ev.which].setState('red');
      ev.targets = [{ id: 'stop', say: ['stop'] }];
      this.hud.showCards([{ clue: { id: 'stop', label: 'STOP', glyph: '🔴' }, side: 'center', kind: 'stop' }]);
    } else if (ev.kind === 'otters') {
      ev.targets = [];
      this.hud.caption('Otters crossing!', 4200);
      this.narrator.say('Look! An otter family is crossing. Let them pass!');
    } else if (ev.kind === 'whee') {
      ev.targets = [{ id: 'wheee', say: ['wheee', 'wee', 'yay'] }];
      this.hud.showCards([{ clue: { id: 'wheee', label: 'WHEEE!', glyph: '🎢' }, side: 'center' }]);
      this.narrator.say('Big slope! Say wheeeee!');
    } else if (ev.kind === 'arrival') {
      ev.targets = [];
      this.#finish();
      return;
    }
    this.onListen(true);
    // quieter narrator: short lines, and only about half the cards get one
    this.armCount = (this.armCount ?? 0) + 1;
    if (ev.kind === 'light') {
      this.narrator.say('Red light! Say stop!');
    } else if (ev.kind === 'fork' && this.armCount % 2 === 1) {
      this.narrator.say(`${ev.left.say[0]}... or ${ev.right.say[0]}?`);
    } else if (ev.kind === 'obstacle' && this.armCount % 2 === 0) {
      this.narrator.say(`Say ${ev.clue.say[0]}!`);
    }
  }

  #resolve(ev, id, how) {
    if (ev.done) return;
    if (ev.kind === 'light') { this.#resolveLight(ev, id, how); return; }
    ev.done = true;
    ev.outcome = how;
    this.onListen(false);
    const praises = ['Well done!', 'Yay Rae!', 'Great job!', 'Wonderful!', 'You did it!'];
    const praise = praises[Math.floor(this.rand() * praises.length)];

    if (ev.kind === 'fork') {
      const goLeft = id === ev.left.id;
      this.player.setLane(goLeft ? -1.1 : 1.1);
      ev.recentreAt = ev.s + 26;
      const said = goLeft ? ev.left : ev.right;
      this.hud.resolveCards(id);
      this.hud.praise(`${said.glyph} ${praise}`);
      if (how === 'said' && this.rand() < 0.45) this.narrator.say(`${said.say[0]}! ${praise}`);
      this.#sticker(said.glyph);
    } else if (ev.kind === 'obstacle') {
      this.player.setLane(ev.safeLane);
      ev.recentreAt = ev.s + 18;
      this.hud.resolveCards(id);
      this.hud.praise(`${ev.clue.glyph} ${praise}`);
      if (how === 'said' && this.rand() < 0.45) this.narrator.say(`${ev.clue.say[0]}! ${praise}`);
      this.#sticker(ev.clue.glyph);
    } else if (ev.kind === 'whee') {
      this.hud.resolveCards('wheee');
      this.hud.praise('🎉 WHEEE!');
      this.confetti.burst(this.player.pos);
      this.hud.flashScreen();
      this.#sticker('🎢');
    } else if (ev.kind === 'otters') {
      this.#sticker('🦦');
    }
    if (this.player.state !== 'ride') this.player.setState('ride');
    this.hud.encourage('');
    console.log('[QA] ' + JSON.stringify({ ev: ev.id, kind: ev.kind, outcome: ev.outcome, tries: ev.tries, s: Math.round(this.player.s) }));
    this.active = null;
  }

  #resolveLight(ev, id, how) {
    if (ev.phase === 'red-approach' && id === 'stop') {
      ev.phase = 'stopped-praised';
      this.hud.resolveCards('stop');
      this.hud.praise('🛑 Good stop!');
      this.narrator.say('Stop! Good girl. We wait for the green man.');
      this.#sticker('🚦');
    } else if (ev.phase === 'green-wait' && id === 'go') {
      ev.phase = 'done';
      ev.done = true;
      ev.outcome = how;
      this.onListen(false);
      this.hud.resolveCards('go');
      this.hud.praise('🟢 Go go go!');
      this.narrator.say('Green light! Off we go!');
      this.player.setState('ride');
      console.log('[QA] ' + JSON.stringify({ ev: ev.id, kind: 'light', outcome: how, tries: ev.tries, s: Math.round(this.player.s) }));
      this.active = null;
    }
  }

  #finish() {
    this.finished = true;
    const arrival = this.events.find((e) => e.kind === 'arrival');
    if (arrival) { arrival.done = true; arrival.outcome = 'done'; }
    this.onFinish?.();
    console.log('[QA] ' + JSON.stringify({ ev: 'arrival', kind: 'arrival', outcome: 'done', s: Math.round(this.player.s) }));
  }

  // ---------- per-frame ----------

  update(dt, t) {
    const s = this.player.s;
    this.confetti.update(dt);
    this.hud.setProgress(s / this.world.L, this.world.route.chapterAt(s).index);
    this.hud.setMicLevel(this.meter.level, true);

    // ambient narration
    for (const a of this.ambient) {
      if (!this.narrated.has(a.s) && s > a.s && s < a.s + 30) {
        this.narrated.add(a.s);
        this.hud.caption(a.text);
        if (!this.active && a.say) this.narrator.say(a.say);
      }
    }

    // animate obstacle visuals near the player
    for (const ev of this.events) {
      if (ev.visual && Math.abs(ev.s - s) < 160) {
        ev.visual.update(dt, t, ev.s - s);
      }
      // re-centre after passing a dodge
      if (ev.recentreAt && s > ev.recentreAt) {
        this.player.setLane(0);
        ev.recentreAt = null;
      }
    }
    if (Math.abs(this.pigeonsS - s) < 160) this.pigeons.update(dt, t, Math.abs(this.pigeonsS - s));

    // arm next event
    if (!this.active && !this.finished) {
      const next = this.events.find((e) => !e.done && !e.shown && s > e.s - 42);
      if (next) this.#arm(next);
    }

    const ev = this.active;
    if (!ev) return;
    this.stateTimer += dt;

    const dToEvent = ev.s - s;

    if (ev.kind === 'fork' || ev.kind === 'obstacle') {
      if (!ev.done) {
        if (dToEvent < 14 && this.player.state === 'ride') this.player.setState('slowing');
        if (dToEvent < 5) {
          this.player.setState('stop');
          ev.stuckOpen = true;
        }
        // gentle prompting loop
        if (this.stateTimer > 7 && this.promptCount < 3) {
          this.promptCount++;
          ev.tries++;
          this.stateTimer = 3.2;
          const word = ev.kind === 'fork' ? ev.left.say[0] : ev.clue.say[0];
          this.hud.encourage(`Try saying: ${word.toUpperCase()}`);
          this.narrator.say(`Say... ${word}!`);
        }
        if (this.promptCount >= 3 && this.stateTimer > 5) {
          // model the word and carry on — never stuck
          const pickId = ev.kind === 'fork' ? ev.left.id : ev.clue.id;
          const word = ev.kind === 'fork' ? ev.left.say[0] : ev.clue.say[0];
          this.narrator.say(`${word}! Let's keep going!`);
          ev.tries++;
          this.#resolve(ev, pickId, 'auto');
        }
      } else if (dToEvent < -20) {
        this.active = null;
      }
    } else if (ev.kind === 'light') {
      this.#updateLight(ev, dToEvent, dt);
    } else if (ev.kind === 'otters') {
      if (dToEvent < 12 && !ev.visual.done) this.player.setState('slowing');
      if (dToEvent < 6 && !ev.visual.done) this.player.setState('stop');
      if (ev.visual.done && !ev.done) {
        this.player.setState('ride');
        this.hud.praise('🦦 Bye bye otters!');
        this.narrator.say('The otters crossed safely. Off we go!');
        this.#resolve(ev, 'otters', 'auto');
      }
    } else if (ev.kind === 'whee') {
      if (!ev.done && dToEvent < -55) {
        this.hud.clearCards();
        this.onListen(false);
        ev.done = true;
        ev.outcome = 'missed';
        console.log('[QA] ' + JSON.stringify({ ev: ev.id, kind: 'whee', outcome: 'missed', s: Math.round(s) }));
        this.active = null;
      }
    }
  }

  #updateLight(ev, dToEvent, dt) {
    if (ev.phase === 'red-approach' || ev.phase === 'stopped-praised') {
      if (dToEvent < 14 && this.player.state === 'ride') this.player.setState('slowing');
      if (dToEvent < 4.5) {
        this.player.setState('stop');
        if (!ev.stopT) {
          ev.stopT = 0;
          if (ev.phase === 'red-approach') {
            // she didn't say it — model it kindly, no penalty
            this.narrator.say('We stop at the red light. Stop!');
            this.hud.resolveCards('stop');
          }
          if (ev.which === 1) this.#startCars();
        }
      }
      if (ev.stopT !== undefined) {
        ev.stopT += dt;
        const waitFor = ev.which === 1 ? 6.5 : 4.5;
        if (ev.stopT > waitFor) {
          ev.phase = 'green-wait';
          ev.greenT = 0;
          this.world.trafficLights[ev.which].setState('green');
          ev.targets = [{ id: 'go', say: ['go'] }];
          this.hud.showCards([{ clue: { id: 'go', label: 'GO!', glyph: '🟢' }, side: 'center', kind: 'go' }]);
          this.narrator.say('Green light! Say go!');
          this.stateTimer = 0;
        }
      }
    } else if (ev.phase === 'green-wait') {
      ev.greenT += dt;
      if (ev.greenT > 7) {
        this.narrator.say('Go! Off we go!');
        this.#resolveLight(ev, 'go', 'auto');
      }
    }
  }

  #startCars() {
    // cars glide across the zebra while Rae waits
    const cars = this.world.cars;
    const r = this.world.route;
    const zs = this.world.marks.zebra2;
    cars.forEach((car, i) => {
      car.userData.crossT = -i * 1.6;
    });
    this.carsCrossing = true;
    this.carUpdate = (dt) => {
      let allDone = true;
      cars.forEach((car) => {
        if (car.userData.crossT === undefined) return;
        car.userData.crossT += dt;
        const t = car.userData.crossT;
        if (t > 0) {
          const d = car.userData.laneOffset - t * 7;
          if (d > -40) allDone = false;
          car.position.copy(r.lateral(zs, d, r.yAt(zs), V3()));
        } else allDone = false;
      });
      if (allDone) { this.carsCrossing = false; this.carUpdate = null; }
    };
  }
}
