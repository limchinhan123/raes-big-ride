# Contributing to Rae's Big Ride

Thanks for considering a contribution. Rae's Big Ride is a small, personal
project maintained by one person. Contributions are reviewed when time permits;
there is no response-time commitment, and not every proposal or pull request
will be accepted. Small, clearly scoped fixes with a reproducible reason are
the most useful place to start.

## Before you begin

- Read the [architecture overview](docs/ARCHITECTURE.md),
  [asset provenance](ASSET_PROVENANCE.md), and
  [third-party notices](THIRD_PARTY_NOTICES.md).
- Open an issue before starting a substantial feature, redesign, dependency
  change, or microphone/speech change. This avoids work that does not fit the
  project.
- Do not include child names, contact details, photos, voice recordings,
  transcripts, or other personal data in issues, pull requests, commits, test
  fixtures, screenshots, or media.

## Set up and verify

The project requires Node.js `^20.19.0 || >=22.12.0`.

```bash
npm ci
npm test
npm run build
npm run dev
```

`npm test` runs the current Vitest unit tests. `npm run build` verifies the
production Vite bundle. `npm run dev` starts the local app; use it for manual
browser checks. There is no end-to-end browser test suite, so changes to input,
gameplay, rendering, or layout need focused manual verification on the browser
and device they affect.

## Keep changes focused

1. Create a branch from current `main`, named for one purpose, for example
   `fix/mobile-mic-restart` or `docs/contributor-guide`.
2. Make one focused change. Avoid drive-by formatting, unrelated refactors, or
   bundled feature work.
3. Use concise, imperative commit subjects that state the outcome, for example
   `Fix mobile speech restart after visibility change`.
4. Run the relevant checks above and describe both automated and manual
   verification in the pull request.
5. Open a pull request against `main` using the provided template.

## Privacy, media, and accessibility checks

### Microphone and speech changes

The game uses browser speech-recognition and speech-synthesis APIs. Any change
to microphone permissions, recognition lifecycle, transcripts, telemetry, or
browser service use needs an explicit privacy review in the pull request. Do
not add recording, storage, transmission, analytics, or logging of child voice
data without maintainer agreement and a documented privacy review.

### Images, audio, and other media

The runtime is procedural, while committed screenshots and the gameplay GIF are
documentation media. Do not add third-party media or reuse child/family media
without clear rights. Add every new committed media file to
[ASSET_PROVENANCE.md](ASSET_PROVENANCE.md) with its source or capture basis and
rights status; preserve relevant license notices.

### Accessibility and interaction

Keep the existing keyboard and touch fallbacks working. For interaction or UI
changes, check readable text, clear status and error messages, keyboard access,
and both voice-available and voice-unavailable flows where relevant.

## What to expect

The maintainer may ask for a smaller scope, additional tests, manual evidence,
or a privacy/media correction before merging. Please do not treat silence as
approval or rely on the project for support, releases, or compatibility
guarantees.
