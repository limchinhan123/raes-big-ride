import { GameWorld } from './world/game-world.js';
import { Player } from './gameplay/player.js';

// Full-journey world test (?mode=world). ?jump=<s> teleports, arrows steer,
// [s] stop toggle. Used for chapter-by-chapter visual QA.

export function startWorldTest() {
  const params = new URLSearchParams(location.search);
  const world = new GameWorld({ pace: params.get('pace') ?? 'quick', params });
  const { engine, route } = world;

  const colorMap = { pink: 0xf291b4, sky: 0x6fb7ea, white: 0xf4f4f0, mint: 0x8fd9b6, butter: 0xffd166, lilac: 0xb9a3e8 };
  const player = new Player(engine, route, {
    vehicle: params.get('v') === 'scooter' ? 'scooter' : 'bike',
    frameColor: colorMap[params.get('c')] ?? colorMap.white,
    pace: params.get('pace') ?? 'quick',
  });
  if (params.has('jump')) player.s = parseFloat(params.get('jump'));
  if (params.has('speed')) player.baseSpeed = parseFloat(params.get('speed'));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') player.setLane(player.laneTarget - 0.8);
    if (e.key === 'ArrowRight') player.setLane(player.laneTarget + 0.8);
    if (e.key === 's') player.setState(player.state === 'stop' ? 'ride' : 'stop');
  });

  const fpsEl = document.createElement('div');
  fpsEl.style.cssText = 'position:fixed;left:10px;bottom:10px;color:#fff;font:12px monospace;background:rgba(0,0,0,0.4);padding:4px 8px;border-radius:6px;z-index:50;';
  document.getElementById('ui').appendChild(fpsEl);

  engine.onUpdate((dt, t) => {
    player.update(dt);
    world.update(dt, t, player.s, player.pos);
    fpsEl.textContent = `${engine.fps.value.toFixed(0)} fps · s=${player.s.toFixed(0)}/${world.L} · ${(player.speed * 3.6).toFixed(0)} km/h · ${route.chapterAt(player.s).id}`;
  });

  engine.start();
  window.__dbg = { world, player };
  console.log('[QA] world-ready');
}
