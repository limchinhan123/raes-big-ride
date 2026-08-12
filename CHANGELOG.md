# Changelog

All notable repository changes are documented here from the first documented
open-source release onward. Earlier development exists in Git history but was
not published with release notes or version tags.

## [1.0.0] — 2026-08-12

First documented open-source release of Rae's Big Ride. The package version was
already `1.0.0`; this release establishes the first documented release record,
not a claim about earlier releases.

### Added

- MIT licensing, package metadata, third-party notices, bundled runtime license
  notices, and provenance for documentation media ([#16](https://github.com/limchinhan123/raes-big-ride/pull/16)).
- Deterministic Vitest coverage for the forgiving speech matcher
  ([#17](https://github.com/limchinhan123/raes-big-ride/pull/17)).
- GitHub Actions CI for `npm ci`, `npm test`, and `npm run build`
  ([#18](https://github.com/limchinhan123/raes-big-ride/pull/18)).
- Contributor guide, architecture overview, issue forms, and pull-request
  template ([#21](https://github.com/limchinhan123/raes-big-ride/pull/21)).
- Privacy and security policies, including browser/provider boundaries and
  guardian guidance ([#22](https://github.com/limchinhan123/raes-big-ride/pull/22)).
- Documentation of the desktop microphone-level analyser path
  ([#23](https://github.com/limchinhan123/raes-big-ride/pull/23)).
- A source-backed repository landing page, changelog, reproducible release
  checklist, and committed release notes.
- A private vulnerability-reporting route through GitHub's Security tab.

### Changed

- Separated the generic speech-matching engine from Rae-specific aliases while
  retaining the existing game-facing adapter ([#19](https://github.com/limchinhan123/raes-big-ride/pull/19)).

### Fixed

- Made unsupported-browser and terminal microphone failures visible, with a
  bounded grown-up fallback for the active card ([#20](https://github.com/limchinhan123/raes-big-ride/pull/20)).

### Known limitations

- Automated tests do not establish real-device speech-recognition reliability.
  Browser support, microphone permission, speech-provider behavior, network,
  room acoustics, and hardware can all affect voice play.
- Language/vocabulary packs and any reusable matcher package remain roadmap
  items, not part of this release: [#14](https://github.com/limchinhan123/raes-big-ride/issues/14) and [#15](https://github.com/limchinhan123/raes-big-ride/issues/15).
