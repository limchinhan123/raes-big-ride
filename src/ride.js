import * as THREE from 'three';
import { buildStyleWorld } from './frame.js';
import { Player } from './gameplay/player.js';
import { Rider } from './character/rider.js';

// Ride test mode (?mode=ride): Rae rides the style-frame world.
// [1]/[2] swap vehicle, arrows steer lanes, [s] toggles stop.

export function startRide() {
  const params = new URLSearchParams(location.search);
  const world = buildStyleWorld(params);
  const { engine, sky, route, terrain, grass, timeU, fpsEl } = world;

  const vehicle = params.get('v') === 'scooter' ? 'scooter' : 'bike';
  const colorMap = { pink: 0xf291b4, sky: 0x6fb7ea, white: 0xf4f4f0, mint: 0x8fd9b6, butter: 0xffd166, lilac: 0xb9a3e8 };
  const player = new Player(engine, route, {
    vehicle,
    frameColor: colorMap[params.get('c')] ?? colorMap.white,
    pace: params.get('pace') ?? 'quick',
  });
  if (params.has('speed')) player.baseSpeed = parseFloat(params.get('speed'));
  if (params.has('noquat')) player.debugNoQuat = true;
  if (params.has('noanim')) player.debugNoAnim = true;
  Rider.debugFlags = {
    nolegs: params.has('nolegs'),
    noarms: params.has('noarms'),
    nopony: params.has('nopony'),
  };

  if (params.has('beacon')) {
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.0, 0.15), new THREE.MeshBasicMaterial({ color: 0xff2288 }));
    beacon.position.set(0, 0.5, 0);
    player.rider.group.add(beacon);
    const beacon2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0x22ddff }));
    engine.scene.add(beacon2);
    engine.onUpdate(() => beacon2.position.copy(player.pos).add(new THREE.Vector3(0.8, 0.3, 0)));
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') player.setLane(player.laneTarget - 0.8);
    if (e.key === 'ArrowRight') player.setLane(player.laneTarget + 0.8);
    if (e.key === 's') player.setState(player.state === 'stop' ? 'ride' : 'stop');
    if (e.key === 'c') player.setState('celebrate');
  });

  const inspect = params.has('inspect');
  let logT = 0;
  engine.onUpdate((dt, t) => {
    timeU.value = t;
    player.update(dt);
    sky.update(dt, player.pos);
    terrain.ensureRange(player.s - 80, player.s + 360);
    grass.ensureRange(player.s - 40, player.s + 260);
    if (inspect) {
      // side-on close camera that tracks the rider
      const p = player.pos;
      engine.camera.position.set(p.x + 1.8, p.y + 0.75, p.z + 1.2);
      engine.camera.lookAt(p.x, p.y + 0.45, p.z);
      engine.camera.fov = 45; engine.camera.updateProjectionMatrix();
    }
    logT += dt;
    if (logT > 1.5) {
      logT = 0;
      const p = player.pos;
      const ray = new THREE.Raycaster(new THREE.Vector3(p.x, p.y + 5, p.z), new THREE.Vector3(0, -1, 0));
      const hits = ray.intersectObjects(world.road.group.children, false);
      const roadY = hits.length ? hits[0].point.y : NaN;
      console.log(`[QA] riderY=${p.y.toFixed(2)} routeY=${route.yAt(player.s).toFixed(2)} roadMeshY=${roadY.toFixed(2)} s=${player.s.toFixed(1)}`);
    }
    fpsEl.textContent = `${engine.fps.value.toFixed(0)} fps · s=${player.s.toFixed(0)} · ${(player.speed * 3.6).toFixed(0)} km/h`;
  });

  engine.start();
  window.__dbg = { ...world, player };
  console.log('[QA] ride-ready');
}
