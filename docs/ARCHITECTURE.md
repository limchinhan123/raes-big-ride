# Architecture overview

Rae's Big Ride is a browser-based, vanilla ES module game built with Vite and
Three.js. The production entry is [`src/main.js`](../src/main.js), which selects
the normal game or focused development modes from the `mode` query parameter.

## Runtime flow

```text
index.html
  ├─ #app canvas → Three.js Engine → GameWorld → player, characters, scenery
  └─ #ui overlay → StartFlow / Hud / pause controls / sticker book

src/main.js → src/game.js → world, gameplay, speech, UI, and audio modules
```

- `src/game.js` coordinates the start flow, ride, finale, speech, audio, and
  parent-facing controls.
- `src/world/` builds the route, terrain, scenery, lighting, and procedural
  world props. `src/core/engine.js` owns the renderer and update loop.
- `src/character/` contains rider and vehicle construction and animation.
- `src/gameplay/` contains movement, clue/event direction, Zoe's companion logic,
  obstacles, crossings, and playtime.
- `src/ui/` renders the start flow, walkthrough, HUD, pause controls, and
  fallback messaging.
- `src/audio/` produces procedural music and sound effects with Web Audio.

## Speech and input seams

- `src/speech/recognizer.js` wraps the browser `SpeechRecognition` API and
  owns desktop/mobile lifecycle, permissions, pause/hold behavior, and events.
- `src/speech/matcher.js`, `src/speech/matchingEngine.js`, and
  `src/speech/raeLexicon.js` normalize and match recognized speech against game
  targets. Their unit tests live alongside the speech modules.
- `src/speech/voiceMeter.js` supplies voice activity feedback; desktop and
  mobile use different input paths to avoid competing microphone consumers.
- `src/speech/narrator.js` wraps browser speech synthesis, while
  `src/speech/simInput.js` supports deterministic QA simulation.

Speech behavior varies by browser and device. Changes in this area need unit
tests where feasible and manual checks of permission-denied, unavailable,
desktop, and mobile flows. They also require the microphone privacy review
described in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Assets and documentation media

The runtime constructs its world, textures, music, and sound effects in code;
it does not load third-party 3D model, image, or audio files. Committed files
under `docs/img/` are README and social-preview screenshots plus a gameplay
GIF, not runtime game assets. Their ownership and capture basis are recorded in
[ASSET_PROVENANCE.md](../ASSET_PROVENANCE.md). Third-party software and font
notices are listed in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## Verification boundaries

`npm test` covers current unit tests, primarily around speech matching and
recognizer lifecycle. `npm run build` verifies that Vite can build the
production bundle. Neither check replaces manual interaction testing for WebGL,
speech permissions, browser/device differences, touch, keyboard fallbacks, or
accessibility.
