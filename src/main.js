import '@fontsource/baloo-2/500.css';
import '@fontsource/baloo-2/700.css';

const params = new URLSearchParams(location.search);
const mode = params.get('mode') ?? 'game';

if (mode === 'ride') {
  const { startRide } = await import('./ride.js');
  startRide();
} else if (mode === 'world') {
  const { startWorldTest } = await import('./world-test.js');
  startWorldTest();
} else if (mode === 'game') {
  const { startGame } = await import('./game.js');
  startGame();
} else {
  const { startFrame } = await import('./frame.js');
  startFrame();
}
