import * as THREE from 'three';
import { Engine } from '../core/engine.js';
import { SkyRig } from './sky.js';
import { Route } from './route.js';
import { Terrain } from './terrain.js';
import { Road } from './road.js';
import { GrassField } from './grass.js';
import { plantBatch } from './trees.js';
import { buildHDB, buildLaundry } from './props/hdb.js';
import { buildLampPost, buildBusStop, buildRailingRun, buildTrafficLight, buildMamaShop, buildOverheadBridge, buildBench, buildCar } from './props/street.js';
import { buildSea, buildRock, buildShip, buildKite, buildShelter } from './props/coast.js';
import { buildPlayground, buildPlushies, buildBalloonArch } from './props/playground.js';
import { buildSkyline } from './props/city.js';
import { buildPerson, buildDog, buildPlane } from './props/npcs.js';
import { buildStall, buildHawkerHall, buildKopiTables } from './props/market.js';
import { buildSleepingCat, buildPigeons } from '../gameplay/obstacles.js';
import { buildBike } from '../character/vehicles/bike.js';
import { mulberry32, fbm1 } from '../core/prng.js';

// The real journey world: five chapters end to end, streamed terrain/grass,
// day progressing from morning to warm late afternoon as Rae rides.

export const LENGTH_BY_PACE = { gentle: 1750, quick: 2350, zoomy: 3050 };

const V3 = () => new THREE.Vector3();

export class GameWorld {
  constructor({ pace = 'quick', seed = 5, params = new URLSearchParams(), deferPopulate = false } = {}) {
    this.deferPopulate = deferPopulate;
    this.engine = new Engine(document.getElementById('app'));
    this.sky = new SkyRig(this.engine);
    this.params = params;

    const length = LENGTH_BY_PACE[pace] ?? LENGTH_BY_PACE.quick;
    this.route = new Route({ length, seed });
    const L = length;
    this.L = L;

    // landmark stations (meters)
    this.marks = {
      mamaShop: 0.08 * L,
      busStop1: 0.115 * L,
      zebra1: 0.145 * L,
      pcn: [0.18 * L, 0.36 * L],
      market: [0.36 * L, 0.52 * L],
      coast: [0.52 * L, 0.70 * L],
      bridge: 0.745 * L,
      zebra2: 0.795 * L,
      busStop2: 0.835 * L,
      arch: L - 26,
      playgroundS: L - 15,
    };

    this.#terrainSetup();
    this.road = new Road(this.route, {
      zebras: [this.marks.zebra1, this.marks.zebra2],
      pcn: this.marks.pcn,
    });
    this.engine.scene.add(this.road.group);

    this.timeU = { value: 0 };
    this.animated = []; // {s, obj} distance-gated animations
    // must exist before setTimeBy() runs — population may be deferred until
    // after the title screen, and setTimeBy iterates these on every frame
    this.facadeMats = [];
    this.grass = new GrassField(this.route, this.terrain, this.timeU);
    this.grass.skipAt = (s, d) => this.#grassSkip(s, d);
    this.engine.scene.add(this.grass.group);

    this.populated = false;
    if (!this.deferPopulate) this.ensurePopulated();
    this.setTimeBy(0);
  }

  // Heavy prop population can be deferred so the title screen appears fast;
  // the start flow kicks it off in the background after the first tap.
  ensurePopulated() {
    if (this.populated) return;
    this.populated = true;
    this.#populate();
  }

  // ---------- terrain shaping ----------

  #terrainSetup() {
    const r = this.route;
    const L = this.L;
    const P0 = V3(), P1 = V3();

    // building pads (filled during populate planning)
    this.pads = [];
    const rand = mulberry32(31);
    const [c0, c1] = [0.0, 0.165];
    for (let f = 0.03; f < c1; f += 0.038 + rand() * 0.018) {
      const side = this.pads.length % 2 === 0 ? -1 : 1;
      this.pads.push({ s: f * L, d: side * (26 + rand() * 12), r: 17, kind: 'hdb', seed: 3 + this.pads.length });
    }
    // market square + surrounding blocks
    this.pads.push({ s: 0.415 * L, d: -20, r: 15, kind: 'market' });
    this.pads.push({ s: 0.46 * L, d: 22, r: 15, kind: 'hdb', seed: 31 });
    this.pads.push({ s: 0.385 * L, d: 30, r: 15, kind: 'hdb', seed: 32 });
    // a couple of city-side blocks
    this.pads.push({ s: 0.74 * L, d: -32, r: 16, kind: 'hdb', seed: 21 });
    this.pads.push({ s: 0.83 * L, d: 30, r: 16, kind: 'hdb', seed: 22 });
    this.pads.push({ s: 0.93 * L, d: -30, r: 16, kind: 'hdb', seed: 23 });
    // mama shop + playground pads
    this.pads.push({ s: this.marks.mamaShop, d: 14, r: 11, kind: 'shop' });
    this.pads.push({ s: this.marks.playgroundS, d: -12.5, r: 17, kind: 'playground' });
    for (const p of this.pads) p.y = r.yAt(p.s) + 0.32;

    const coast = this.marks?.coast ?? [0.52 * L, 0.70 * L];
    const shoreAt = (s) => 8.5 + (fbm1(s * 0.008, 2, 91) - 0.5) * 5;

    const shape = (s, d, h, roadY) => {
      let out = h;
      // pads flatten a level platform for each building/plaza NEAR the pad,
      // blending back to natural rolling ground beyond it. NB smoothstep is
      // (x, edge0, edge1) with edge0 < edge1 and rises 0->1; we want 1 AT the
      // pad and 0 away from it, so invert the rising ramp. (Passing the edges
      // reversed silently returned 1 everywhere far from a pad, which flattened
      // the whole map to the last pad's height and left the road cutting
      // through a dead-flat plane.)
      for (const p of this.pads) {
        r.lateral(s, d, 0, P0);
        r.lateral(p.s, p.d, 0, P1);
        const dist = Math.hypot(P0.x - P1.x, P0.z - P1.z);
        const w = 1 - THREE.MathUtils.smoothstep(dist, p.r, p.r + 13);
        out = THREE.MathUtils.lerp(out, p.y, w);
      }
      // coast: right side slides into the sea
      const inCoast = THREE.MathUtils.smoothstep(s, coast[0] - 35, coast[0] + 25) *
        (1 - THREE.MathUtils.smoothstep(s, coast[1] - 25, coast[1] + 35));
      if (inCoast > 0 && d > 4) {
        const shore = shoreAt(s);
        const t = THREE.MathUtils.smoothstep(d, shore, shore + 15);
        const seaFloor = -2.1;
        const beachH = roadY + 0.1 - (d - 4) * 0.045; // gentle beach slope
        const coastH = THREE.MathUtils.lerp(Math.min(out, beachH), seaFloor, t);
        out = THREE.MathUtils.lerp(out, coastH, inCoast);
      }
      return out;
    };

    const materialMask = (s, d) => {
      const inCoast = s > coast[0] - 10 && s < coast[1] + 10;
      if (inCoast && d > 4.2 && d < shoreAt(s) + 12) return 1; // sand
      const ad = Math.abs(d);
      if (ad > 3.4 && ad < 4.7 && fbm1(s * 0.05, 2, 803) > 0.48) return 2 * Math.min(1, (4.7 - ad));
      return 0;
    };

    this.coastRange = coast;
    this.shoreAt = shoreAt;
    this.terrain = new Terrain(this.route, { shape, materialMask });
    this.engine.scene.add(this.terrain.group);
  }

  #grassSkip(s, d) {
    // no grass on sand/sea side
    if (s > this.coastRange[0] - 10 && s < this.coastRange[1] + 10 && d > 4.2) return true;
    // market forecourt is paved, not lawn
    const mk = this.marks?.market;
    if (mk && s > mk[0] && s < mk[1] && Math.abs(d) < 9) return true;
    const P0 = V3(), P1 = V3();
    for (const p of this.pads) {
      if (Math.abs(p.s - s) > p.r + 8) continue;
      this.route.lateral(s, d, 0, P0);
      this.route.lateral(p.s, p.d, 0, P1);
      if (Math.hypot(P0.x - P1.x, P0.z - P1.z) < p.r * 0.8) return true;
    }
    return false;
  }

  // ---------- population ----------

  #at(s, d, sink = 0.05) {
    return this.route.lateral(s, d, this.terrain.heightAt(s, d) - sink, V3());
  }

  #face(obj, s, d) {
    // rotate +Z toward the road
    const pos = obj.position;
    const road = this.route.lateral(s, 0, pos.y, V3());
    obj.rotation.y = Math.atan2(road.x - pos.x, road.z - pos.z);
  }

  #populate() {
    const scene = this.engine.scene;
    const r = this.route;
    const L = this.L;
    const rand = mulberry32(77);
    const AXIS_Y = new THREE.Vector3(0, 1, 0);
    this.facadeMats = [];

    // --- HDB blocks on their pads + far backdrop blocks
    for (const p of this.pads) {
      if (p.kind !== 'hdb') continue;
      const hdb = buildHDB({
        seed: p.seed, floors: 10 + (p.seed % 5), bays: 7 + (p.seed % 3),
        paletteIndex: p.seed % 5, emissiveIntensity: 0,
      });
      hdb.position.copy(r.lateral(p.s, p.d, p.y, V3()));
      this.#face(hdb, p.s, p.d);
      hdb.rotation.y += (rand() - 0.5) * 0.5;
      scene.add(hdb);
      this.facadeMats.push(hdb.userData.facadeMat);
      const laundry = buildLaundry(p.seed * 3);
      laundry.position.copy(hdb.position).add(new THREE.Vector3(0, (10 + (p.seed % 5)) * 2.85 * 0.5, 0));
      laundry.quaternion.copy(hdb.quaternion);
      laundry.translateZ(5.7);
      scene.add(laundry);
    }
    for (let i = 0; i < 14; i++) {
      const s = (0.06 + 0.9 * (i / 14)) * L + rand() * 30;
      if (s > this.coastRange[0] - 30 && s < this.coastRange[1] + 20) continue; // sea side handled
      const d = (i % 2 ? -1 : 1) * (55 + rand() * 60);
      const hdb = buildHDB({ seed: 50 + i, floors: 10 + (i % 5), bays: 7 + (i % 4), paletteIndex: i % 5, emissiveIntensity: 0 });
      hdb.position.copy(this.#at(s, d, 0.5));
      hdb.rotation.y = rand() * Math.PI;
      scene.add(hdb);
      this.facadeMats.push(hdb.userData.facadeMat);
    }

    // --- mama shop
    const shopPad = this.pads.find((p) => p.kind === 'shop');
    const shop = buildMamaShop(5);
    shop.position.copy(r.lateral(shopPad.s, shopPad.d, shopPad.y, V3()));
    this.#face(shop, shopPad.s, shopPad.d);
    scene.add(shop);

    // --- bus stops + lamp posts
    for (const [s, d] of [[this.marks.busStop1, -4.6], [this.marks.busStop2, 4.6]]) {
      const stop = buildBusStop();
      stop.position.copy(this.#at(s, d, 0.02));
      this.#face(stop, s, d);
      stop.rotation.y += Math.PI; // shelter opens toward road
      scene.add(stop);
    }
    for (let s = 24; s < L - 30; s += 42 + rand() * 14) {
      const inPcn = s > this.marks.pcn[0] && s < this.marks.pcn[1];
      const inCoast = s > this.coastRange[0] && s < this.coastRange[1];
      if (inPcn) continue;
      const side = inCoast ? -1 : (Math.floor(s / 42) % 2 ? 1 : -1);
      const lamp = buildLampPost();
      lamp.position.copy(this.#at(s, side * 4.4, 0.02));
      this.#face(lamp, s, side * 4.4);
      scene.add(lamp);
    }

    // --- PCN railings + exercise-corner benches
    const [p0, p1] = this.marks.pcn;
    for (let s = p0; s < p1 - 30; s += 90 + rand() * 60) {
      const side = rand() < 0.5 ? -1 : 1;
      const len = 30 + rand() * 30;
      scene.add(buildRailingRun(r, this.terrain, s, Math.min(s + len, p1), side * 3.9));
    }
    for (let i = 0; i < 3; i++) {
      const s = p0 + (i + 0.5) * ((p1 - p0) / 3);
      const bench = buildBench();
      bench.position.copy(this.#at(s, (i % 2 ? 1 : -1) * 6.4, 0.02));
      this.#face(bench, s, (i % 2 ? 1 : -1) * 6.4);
      scene.add(bench);
    }

    // --- trees everywhere (batched per 150m), palms on the coast sand
    for (let seg = 0; seg < L; seg += 150) {
      const placements = [];
      const segEnd = Math.min(seg + 150, L);
      const inPcnSeg = seg >= p0 - 50 && seg <= p1;
      const density = inPcnSeg ? 30 : 46;
      for (let s = seg + rand() * 20; s < segEnd; s += density * (0.7 + rand() * 0.6)) {
        const inCoast = s > this.coastRange[0] && s < this.coastRange[1];
        for (const side of [-1, 1]) {
          if (rand() < (inPcnSeg ? 0.85 : 0.55)) {
            if (inCoast && side === 1) {
              // palms on the beach
              const d = 5.5 + rand() * 5;
              placements.push({ type: 'palm', seed: 900 + (s | 0), pos: this.#at(s, d, 0.1), rotY: rand() * 6.3, scale: 0.9 + rand() * 0.35 });
            } else {
              const d = side * (7.5 + rand() * 22);
              if (this.#grassSkip(s, d)) continue;
              placements.push({ type: 'rain', seed: 100 + (s | 0) + side, pos: this.#at(s, d, 0.1), rotY: rand() * 6.3, scale: 0.85 + rand() * 0.5 });
            }
          }
        }
      }
      for (let s = seg + rand() * 10; s < segEnd; s += 16 + rand() * 14) {
        const side = rand() < 0.5 ? -1 : 1;
        const d = side * (4.6 + rand() * 2.2);
        if (this.#grassSkip(s, d)) continue;
        placements.push({ type: 'shrub', seed: 500 + (s | 0), pos: this.#at(s, d, 0.06), rotY: rand() * 6.3, scale: 0.8 + rand() * 0.5, flowering: rand() < 0.5 });
      }
      if (placements.length) scene.add(plantBatch(placements, this.timeU));
    }

    // --- coast: sea, rocks, ships, kites, shelters
    const coastMid = (this.coastRange[0] + this.coastRange[1]) / 2;
    const sea = buildSea(this.timeU);
    const seaGroup = new THREE.Group();
    seaGroup.add(sea.mesh);
    // plane local +y (after flat rotation) points toward -Z of the group; aim it at the shore
    const seaCenter = r.lateral(coastMid, 168, -0.55, V3());
    seaGroup.position.copy(seaCenter);
    const shoreDir = r.rightAt(coastMid, V3()).negate();
    seaGroup.rotation.y = Math.atan2(shoreDir.x, shoreDir.z) - Math.PI;
    scene.add(seaGroup);
    this.sea = sea;

    for (let i = 0; i < 8; i++) {
      const s = this.coastRange[0] + 20 + rand() * (this.coastRange[1] - this.coastRange[0] - 40);
      const rock = buildRock(200 + i, 0.8 + rand() * 1.6);
      rock.position.copy(this.#at(s, this.shoreAt(s) + 1 + rand() * 3, -0.2));
      scene.add(rock);
    }
    for (let i = 0; i < 3; i++) {
      const ship = buildShip(i);
      const s = this.coastRange[0] + (i + 0.6) * ((this.coastRange[1] - this.coastRange[0]) / 4);
      ship.position.copy(r.lateral(s, 190 + i * 55, -0.4, V3()));
      ship.rotation.y = rand() * Math.PI;
      scene.add(ship);
    }
    for (let i = 0; i < 2; i++) {
      const kite = buildKite([0xf291b4, 0x6fb7ea][i]);
      const s = this.coastRange[0] + (i + 0.8) * 60;
      kite.position.copy(this.#at(s, 8 + i * 3, -9 - i * 3));
      kite.userData.base = kite.position.clone();
      kite.userData.update = (t) => {
        kite.position.x = kite.userData.base.x + Math.sin(t * 0.5 + i * 2) * 2.2;
        kite.position.y = kite.userData.base.y + Math.sin(t * 0.8 + i) * 1.1;
        kite.rotation.z = Math.sin(t * 0.7) * 0.2;
      };
      this.animated.push({ s, obj: kite });
      scene.add(kite);
    }
    for (const off of [0.25, 0.7]) {
      const s = this.coastRange[0] + off * (this.coastRange[1] - this.coastRange[0]);
      const shelter = buildShelter();
      shelter.position.copy(this.#at(s, -7.5, 0.02));
      scene.add(shelter);
    }

    // skyline across the water + city chapter backdrop
    const skyline1 = buildSkyline();
    skyline1.position.copy(r.lateral(this.coastRange[1] + 40, 420, -0.5, V3()));
    skyline1.rotation.y = seaGroup.rotation.y + Math.PI;
    scene.add(skyline1);
    const skyline2 = buildSkyline();
    skyline2.position.copy(r.lateral(0.78 * L, -170, 0, V3()));
    this.#face(skyline2, 0.78 * L, -170);
    scene.add(skyline2);

    // --- city: overhead bridge + traffic lights + crossing cars
    const bridge = buildOverheadBridge();
    bridge.position.copy(r.lateral(this.marks.bridge, 0, r.yAt(this.marks.bridge), V3()));
    const bdir = r.dirAt(this.marks.bridge, V3());
    bridge.rotation.y = Math.atan2(bdir.x, bdir.z) + Math.PI / 2;
    scene.add(bridge);

    this.trafficLights = [];
    for (const [zs, side] of [[this.marks.zebra1, 1], [this.marks.zebra2, -1]]) {
      const tl = buildTrafficLight();
      tl.group.position.copy(this.#at(zs - 4.5, side * 4.1, 0.02));
      this.#face(tl.group, zs - 4.5, side * 4.1);
      scene.add(tl.group);
      this.trafficLights.push({ ...tl, s: zs });
    }
    // crossing cars wait beside zebra2 on a small side road
    this.cars = [];
    const carColors = [0xd8dade, 0x8fb3d8, 0xd8a03c];
    // side road stops at the kerbs on each side — never crosses the crowned
    // carriageway (that z-fights and flickers)
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x5c5e62, roughness: 0.95 });
    const zright = r.rightAt(this.marks.zebra2, V3());
    for (const side of [-1, 1]) {
      const wrap = new THREE.Group();
      const half = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 26), sideMat);
      half.rotation.x = -Math.PI / 2;
      half.receiveShadow = true;
      wrap.add(half);
      wrap.position.copy(r.lateral(this.marks.zebra2, side * 16.6, r.yAt(this.marks.zebra2) + 0.02, V3()));
      wrap.rotation.y = Math.atan2(zright.x, zright.z);
      scene.add(wrap);
    }
    for (let i = 0; i < 3; i++) {
      const car = buildCar(carColors[i]);
      car.position.copy(r.lateral(this.marks.zebra2, 12 + i * 8, r.yAt(this.marks.zebra2), V3()));
      const cd = r.rightAt(this.marks.zebra2, V3()).negate();
      car.rotation.y = Math.atan2(cd.x, cd.z);
      car.userData.laneOffset = 12 + i * 8;
      scene.add(car);
      this.cars.push(car);
    }

    // --- finale: playground, plushies, balloons, benches
    const pgPad = this.pads.find((p) => p.kind === 'playground');
    const pg = buildPlayground();
    pg.position.copy(r.lateral(pgPad.s, pgPad.d, pgPad.y, V3()));
    this.#face(pg, pgPad.s, pgPad.d);
    scene.add(pg);

    const plush = buildPlushies();
    const bench = buildBench();
    bench.position.copy(r.lateral(pgPad.s + 6, -5.2, this.terrain.heightAt(pgPad.s + 6, -5.2), V3()));
    this.#face(bench, pgPad.s + 6, -5.2);
    scene.add(bench);
    plush.position.copy(bench.position).add(new THREE.Vector3(0, 0.5, 0));
    plush.quaternion.copy(bench.quaternion);
    scene.add(plush);
    this.plushies = plush;

    const arch = buildBalloonArch(this.timeU);
    arch.position.copy(r.lateral(this.marks.arch, 0, r.yAt(this.marks.arch), V3()));
    arch.scale.set(1.18, 1.05, 1);
    const adir = r.dirAt(this.marks.arch, V3());
    arch.rotation.y = Math.atan2(adir.x, adir.z);
    scene.add(arch);
    this.animated.push({ s: this.marks.arch, obj: arch });

    this.#populateMarket(rand);
    this.#populateLife(rand);
  }

  // --- the wet market & hawker chapter: stalls, hall, kopi tables, crowds
  #populateMarket(rand) {
    const scene = this.engine.scene;
    const r = this.route;
    const [m0, m1] = this.marks.market;

    const pad = this.pads.find((p) => p.kind === 'market');
    const hall = buildHawkerHall();
    hall.position.copy(r.lateral(pad.s, pad.d, pad.y, V3()));
    this.#face(hall, pad.s, pad.d);
    scene.add(hall);

    const tables = buildKopiTables(7);
    tables.position.copy(r.lateral(pad.s + 9, pad.d + 5, pad.y, V3()));
    this.#face(tables, pad.s + 9, pad.d + 5);
    scene.add(tables);

    // stall rows down both verges through the chapter
    for (let s = m0 + 14; s < m1 - 14; s += 7.5 + rand() * 3) {
      for (const side of [-1, 1]) {
        if (rand() < 0.32) continue;
        const d = side * (5.4 + rand() * 0.9);
        const stall = buildStall(900 + Math.round(s) + side);
        stall.position.copy(this.#at(s, d, 0.02));
        this.#face(stall, s, d);
        stall.rotation.y += Math.PI; // counter faces the road
        scene.add(stall);

        // a shopper or stallholder beside most stalls
        if (rand() < 0.75) {
          const who = buildPerson(1200 + Math.round(s) + side);
          const pd = d + side * (rand() < 0.5 ? -1.35 : 1.1);
          who.group.position.copy(this.#at(s + (rand() - 0.5) * 1.6, pd, 0.02));
          who.group.rotation.y = rand() * Math.PI * 2;
          scene.add(who.group);
          who.group.userData.update = (t) => who.idle(t);
          this.animated.push({ s, obj: who.group });
        }
      }
    }
    this.marketRange = [m0, m1];
  }

  // --- Rae loves people: pedestrians, cyclists, dogs, queues, kids, a plane
  #populateLife(rand) {
    const scene = this.engine.scene;
    const r = this.route;
    const L = this.L;
    const AXIS_Y = new THREE.Vector3(0, 1, 0);

    // strolling pedestrians along the verge (ping-pong walk)
    const walkerCount = 11;
    for (let i = 0; i < walkerCount; i++) {
      const s0 = (0.05 + 0.88 * (i / walkerCount)) * L + rand() * 40;
      const side = rand() < 0.5 ? -1 : 1;
      const inCoast = s0 > this.coastRange[0] && s0 < this.coastRange[1];
      const d = (inCoast && side === 1) ? 5.2 : side * (4.9 + rand() * 1.6);
      if (this.#grassSkip(s0, d)) continue;
      const person = buildPerson(300 + i);
      const span = 16 + rand() * 16;
      const speed = 0.55 + rand() * 0.3;
      const phase = rand() * 10;
      scene.add(person.group);
      const withDog = rand() < 0.3;
      let dog = null;
      if (withDog) {
        dog = buildDog(600 + i);
        scene.add(dog.group);
      }
      const P = V3();
      person.group.userData.update = (t) => {
        const tt = t * speed + phase;
        const cycle = tt % 2;
        const dir = cycle < 1 ? 1 : -1;
        const local = cycle < 1 ? cycle : 2 - cycle;
        const s = s0 + local * span;
        this.route.lateral(s, d, this.terrain.heightAt(s, d), P);
        person.group.position.copy(P);
        const rd = this.route.dirAt(s, V3());
        person.group.rotation.y = Math.atan2(rd.x * dir, rd.z * dir);
        person.walk(t, speed * 1.5);
        if (dog) {
          this.route.lateral(s + dir * 0.9, d + 0.55, this.terrain.heightAt(s + dir * 0.9, d + 0.55), P);
          dog.group.position.copy(P);
          dog.group.rotation.y = person.group.rotation.y;
          dog.walk(t);
        }
      };
      this.animated.push({ s: s0, obj: person.group });
    }

    // oncoming NPC cyclists on the far lane
    const cyclistColors = [0x8a99a8, 0x5a8fd0, 0xd8a03c, 0x6fae6a];
    for (let i = 0; i < 4; i++) {
      const group = new THREE.Group();
      const bike = buildBike({ frameColor: cyclistColors[i] });
      // grown-up NPC bike: scale up, hide training wheels + basket
      bike.group.scale.setScalar(1.35);
      for (const tw of bike.wheels.training) tw.visible = false;
      group.add(bike.group);
      const person = buildPerson(400 + i);
      person.group.scale.setScalar(1.05);
      person.group.position.set(0, 0.52, -0.28);
      // seated pose
      person.group.rotation.x = 0.12;
      group.add(person.group);
      scene.add(group);
      const segStart = (0.12 + i * 0.22) * L;
      const segLen = 260;
      const speed = 3.6 + rand();
      const phase = rand() * segLen;
      const P = V3();
      group.userData.update = (t) => {
        const s = segStart + segLen - ((t * speed + phase) % segLen);
        this.route.lateral(s, -1.75, this.route.yAt(s) + 0.033, P);
        group.position.copy(P);
        const rd = this.route.dirAt(s, V3());
        group.rotation.y = Math.atan2(-rd.x, -rd.z);
        bike.wheels.front.rotation.x += speed / 0.175 * 0.016;
        bike.wheels.rear.rotation.x += speed / 0.175 * 0.016;
        bike.crank.rotation.x += speed * 0.016 * 2.6;
      };
      this.animated.push({ s: segStart + segLen / 2, obj: group, range: 320 });
    }

    // bus stop queues
    for (const bs of [this.marks.busStop1, this.marks.busStop2]) {
      for (let i = 0; i < 2; i++) {
        const side = bs === this.marks.busStop1 ? -1 : 1;
        const person = buildPerson(500 + (bs | 0) + i);
        const P = this.#at(bs - 1.5 + i * 1.3, side * 5.4, 0.02);
        person.group.position.copy(P);
        this.#face(person.group, bs, side * 5.4);
        scene.add(person.group);
        person.group.userData.update = (t) => person.idle(t);
        this.animated.push({ s: bs, obj: person.group });
      }
    }

    // kids + parent at the finale playground
    const pgPad = this.pads.find((p) => p.kind === 'playground');
    for (let i = 0; i < 2; i++) {
      const kid = buildPerson(700 + i, { child: true });
      const P = this.route.lateral(pgPad.s + 2 + i * 3, pgPad.d + 3 - i * 5, pgPad.y, V3());
      kid.group.position.copy(P);
      kid.group.rotation.y = rand() * Math.PI * 2;
      scene.add(kid.group);
      kid.group.userData.update = (t) => kid.jump(t);
      this.animated.push({ s: pgPad.s, obj: kid.group });
    }
    const parent = buildPerson(710);
    parent.group.position.copy(this.route.lateral(pgPad.s + 5, pgPad.d + 5, pgPad.y, V3()));
    this.#face(parent.group, pgPad.s, 0);
    scene.add(parent.group);
    parent.group.userData.update = (t) => parent.idle(t);
    this.animated.push({ s: pgPad.s, obj: parent.group });

    // parked cars along the kerb (heartland + city)
    const parkedColors = [0xd8dade, 0x8fb3d8, 0xd8a03c, 0x9a4a3c];
    const parkSpots = [0.055, 0.14, 0.7, 0.82];
    for (let i = 0; i < parkSpots.length; i++) {
      const s = parkSpots[i] * L;
      const side = i % 2 ? 1 : -1;
      const car = buildCar(parkedColors[i]);
      car.position.copy(this.#at(s, side * 4.6, 0.04));
      const rd = r.dirAt(s, V3());
      car.rotation.y = Math.atan2(rd.x, rd.z) + (side === 1 ? Math.PI : 0);
      scene.add(car);
    }

    // extra nap cats + pigeons near the playground
    for (const [fs, fd] of [[0.24, 5.1], [0.79, -5.3]]) {
      const cat = buildSleepingCat();
      cat.group.position.copy(this.#at(fs * L, fd, 0.04));
      cat.group.rotation.y = rand() * Math.PI * 2;
      scene.add(cat.group);
      cat.group.userData.update = (t) => cat.update(0.016, t, 999);
      this.animated.push({ s: fs * L, obj: cat.group });
    }
    const pgPigeons = buildPigeons(31);
    pgPigeons.group.position.copy(this.#at(L - 40, -4.4, 0.03));
    scene.add(pgPigeons.group);
    pgPigeons.group.userData.update = (t) => pgPigeons.update(0.016, t, 999);
    this.animated.push({ s: L - 40, obj: pgPigeons.group });

    // an airliner crossing the sky every ~80 seconds
    const plane = buildPlane();
    scene.add(plane);
    plane.userData.noCull = true;
    plane.userData.update = (t) => {
      const cyc = (t % 80) / 80;
      const along = -600 + cyc * 2400;
      const focus = this.lastFocus ?? new THREE.Vector3();
      plane.position.set(focus.x + along * 0.42 - 300, 150 + Math.sin(cyc * Math.PI) * 18, focus.z - 500 + along * 0.55);
      plane.rotation.y = Math.atan2(0.42, 0.55);
      plane.visible = cyc > 0.02 && cyc < 0.98;
    };
    this.plane = plane;
  }

  // ---------- runtime ----------

  setTimeBy(s) {
    const k = THREE.MathUtils.clamp(s / this.L, 0, 1);
    const tod = 0.12 + 0.88 * Math.pow(k, 0.92);
    this.sky.setTimeOfDay(tod);
    const lit = THREE.MathUtils.smoothstep(tod, 0.72, 0.98) * 0.55;
    for (const m of this.facadeMats ?? []) m.emissiveIntensity = lit;
    if (this.sea) {
      this.sea.uniforms.uSunDir.value.copy(this.sky.sunDir);
      this.sea.uniforms.uSunColor.value.copy(this.sky.sun.color);
    }
  }

  update(dt, t, playerS, playerPos) {
    this.timeU.value = t;
    if (this.sea) this.sea.uniforms.uTime.value = t % 300;  // bounded sea clock
    this.lastFocus = playerPos;
    this.sky.update(dt, playerPos);
    this.terrain.ensureRange(Math.max(0, playerS - 90), Math.min(this.L, playerS + 380));
    this.grass.ensureRange(Math.max(0, playerS - 50), Math.min(this.L, playerS + 240));
    this.setTimeBy(playerS);
    for (const a of this.animated) {
      if (Math.abs(a.s - playerS) < (a.range ?? 220)) {
        if (a.obj.userData.update) a.obj.userData.update(t);
      }
    }
    this.plane?.userData.update(t);
  }
}
