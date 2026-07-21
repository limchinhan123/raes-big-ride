import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { SkyRig } from './world/sky.js';
import { Route } from './world/route.js';
import { Terrain } from './world/terrain.js';
import { Road } from './world/road.js';
import { GrassField } from './world/grass.js';
import { plantBatch } from './world/trees.js';
import { buildHDB, buildLaundry } from './world/props/hdb.js';

// Shared test-world assembly: the heartland street slice used by the style
// frame (?mode=frame) and the ride test (?mode=ride).

export function buildStyleWorld(params) {
  const tod = parseFloat(params.get('t') ?? '0.5');

  const engine = new Engine(document.getElementById('app'));
  const sky = new SkyRig(engine);
  sky.setTimeOfDay(tod);

  if (params.has('noshadow')) sky.sun.castShadow = false;
  if (params.has('nofog')) engine.scene.fog.density = 0;
  if (params.has('nosky')) sky.sky.visible = false;
  if (params.has('noglow')) sky.sunGlow.visible = false;
  if (params.has('nobloom')) engine.bloomPass.enabled = false;

  const route = new Route({ length: 1800, seed: 5 });

  const pads = [
    { s: 60, d: -26, r: 18 },
    { s: 118, d: -30, r: 18 },
    { s: 175, d: -25, r: 18 },
    { s: 95, d: 34, r: 15 },
  ];
  for (const p of pads) p.y = route.yAt(p.s) + 0.35;

  const P0 = new THREE.Vector3(), P1 = new THREE.Vector3();
  const padShape = (s, d, h) => {
    let out = h;
    for (const p of pads) {
      route.lateral(s, d, 0, P0);
      route.lateral(p.s, p.d, 0, P1);
      const dist = Math.hypot(P0.x - P1.x, P0.z - P1.z);
      const w = THREE.MathUtils.smoothstep(dist, p.r + 14, p.r);
      out = THREE.MathUtils.lerp(out, p.y, w);
    }
    return out;
  };

  const terrain = new Terrain(route, { shape: padShape });
  if (params.has('flat')) terrain.material = new THREE.MeshLambertMaterial({ color: 0x4e7a34 });
  if (!params.has('noterrain')) engine.scene.add(terrain.group);
  terrain.ensureRange(0, 420);

  const road = new Road(route, { zebras: [96], pcn: [0, 0] });
  if (!params.has('noroad')) engine.scene.add(road.group);

  const timeU = { value: 0 };
  const grass = new GrassField(route, terrain, timeU);
  engine.scene.add(grass.group);
  grass.skipAt = (s, d) => {
    for (const p of pads) {
      route.lateral(s, d, 0, P0);
      route.lateral(p.s, p.d, 0, P1);
      if (Math.hypot(P0.x - P1.x, P0.z - P1.z) < p.r * 0.75) return true;
    }
    return false;
  };
  if (!params.has('nograss')) grass.ensureRange(0, 330);

  const T = (s, d) => route.lateral(s, d, terrain.heightAt(s, d) - 0.05, new THREE.Vector3());
  const trees = plantBatch([
    { type: 'rain', seed: 11, pos: T(26, 9.5), rotY: 0.4, scale: 1.05 },
    { type: 'rain', seed: 23, pos: T(84, 12), rotY: 2.2, scale: 1.25 },
    { type: 'rain', seed: 31, pos: T(148, 10), rotY: 4.0, scale: 0.95 },
    { type: 'rain', seed: 47, pos: T(120, -52), rotY: 1.1, scale: 1.35 },
    { type: 'rain', seed: 53, pos: T(210, -14), rotY: 2.8, scale: 1.1 },
    { type: 'shrub', seed: 61, pos: T(40, 5.2), flowering: true },
    { type: 'shrub', seed: 67, pos: T(52, -5.4), flowering: false },
    { type: 'shrub', seed: 71, pos: T(72, 5.6), flowering: true },
    { type: 'shrub', seed: 79, pos: T(108, -5.2), flowering: true },
    { type: 'shrub', seed: 83, pos: T(132, 6.1), flowering: false },
  ], timeU);
  engine.scene.add(trees);

  const AXIS_Y = new THREE.Vector3(0, 1, 0);
  const blocks = [
    { pad: pads[0], floors: 12, bays: 8, palette: 0, seed: 3 },
    { pad: pads[1], floors: 13, bays: 9, palette: 1, seed: 8 },
    { pad: pads[2], floors: 11, bays: 7, palette: 2, seed: 12 },
    { pad: pads[3], floors: 12, bays: 8, palette: 3, seed: 17 },
  ];
  for (const b of blocks) {
    const hdb = buildHDB({ seed: b.seed, floors: b.floors, bays: b.bays, paletteIndex: b.palette, emissiveIntensity: tod > 0.75 ? 0.5 : 0 });
    const pos = route.lateral(b.pad.s, b.pad.d, b.pad.y, new THREE.Vector3());
    hdb.position.copy(pos);
    const toRoad = route.lateral(b.pad.s, 0, b.pad.y, new THREE.Vector3()).sub(pos);
    hdb.quaternion.setFromAxisAngle(AXIS_Y, Math.atan2(toRoad.x, toRoad.z));
    engine.scene.add(hdb);
    const laundry = buildLaundry(b.seed * 3);
    laundry.position.copy(pos).add(new THREE.Vector3(0, b.floors * 2.85 * 0.55, 0));
    laundry.quaternion.copy(hdb.quaternion);
    laundry.translateZ(5.6);
    engine.scene.add(laundry);
  }

  for (let i = 0; i < 6; i++) {
    const s = 320 + i * 55;
    const d = (i % 2 ? -1 : 1) * (40 + (i * 13) % 30);
    const hdb = buildHDB({ seed: 40 + i, floors: 10 + (i % 4), bays: 7 + (i % 3), paletteIndex: i % 5, emissiveIntensity: tod > 0.75 ? 0.5 : 0 });
    hdb.position.copy(route.lateral(s, d, route.yAt(s), new THREE.Vector3()));
    hdb.quaternion.setFromAxisAngle(AXIS_Y, (i * 1.3) % Math.PI);
    engine.scene.add(hdb);
  }

  const fpsEl = document.createElement('div');
  fpsEl.style.cssText = 'position:fixed;left:10px;bottom:10px;color:#fff;font:12px monospace;background:rgba(0,0,0,0.4);padding:4px 8px;border-radius:6px;z-index:50;';
  document.getElementById('ui').appendChild(fpsEl);

  return { engine, sky, route, terrain, grass, road, timeU, fpsEl, params, tod };
}

export function startFrame() {
  const params = new URLSearchParams(location.search);
  const world = buildStyleWorld(params);
  const { engine, sky, route, timeU, fpsEl } = world;
  const camS = parseFloat(params.get('s') ?? '10');

  const camPos = route.lateral(camS, -1.2, route.yAt(camS) + 1.5, new THREE.Vector3());
  const lookAt = route.lateral(camS + 46, 0.4, route.yAt(camS + 46) + 1.0, new THREE.Vector3());
  engine.camera.position.copy(camPos);
  engine.camera.lookAt(lookAt);

  const focus = route.lateral(camS + 20, 0, route.yAt(camS + 20), new THREE.Vector3());
  engine.onUpdate((dt, t) => {
    timeU.value = t;
    sky.update(dt, focus);
    engine.camera.position.copy(camPos);
    engine.camera.position.y += Math.sin(t * 0.5) * 0.03;
    engine.camera.lookAt(lookAt);
    fpsEl.textContent = `${engine.fps.value.toFixed(0)} fps`;
  });

  engine.start();
  window.__dbg = world;
  console.log('[QA] frame-ready');
}
