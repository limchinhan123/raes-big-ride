# Releasing Rae's Big Ride

This is a lightweight checklist for a source release of the web application.
It does not publish an npm package.

## Before creating a release

1. Start from a clean, current `main` branch.

   ```bash
   git switch main
   git pull --ff-only origin main
   git status --short
   ```

   Do not release with local changes. Confirm the OSS-readiness issues
   [#6](https://github.com/limchinhan123/raes-big-ride/issues/6) through
   [#12](https://github.com/limchinhan123/raes-big-ride/issues/12) are closed.

2. Run the reproducible local checks.

   ```bash
   npm ci
   npm test
   npm run build
   npm audit
   ```

3. Confirm the `main` [CI workflow](../.github/workflows/ci.yml) is green and
   that the [Vercel production deployment](https://raes-big-ride.vercel.app/)
   is reachable. Perform a focused real-device smoke test of the changed flows,
   including microphone permission and unavailable-voice behavior when speech
   code changed.

4. Update `CHANGELOG.md` and add committed release notes at
   `docs/releases/vX.Y.Z.md`. Keep release claims limited to checks actually
   run and limitations actually known.

## Publish the source release

After the release notes are committed on `main`, create and push an annotated
tag:

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

Create the GitHub release from the committed release notes:

```bash
gh release create vX.Y.Z \
  --verify-tag \
  --title "vX.Y.Z" \
  --notes-file docs/releases/vX.Y.Z.md
```

Do **not** run `npm publish`: this repository is a web application and remains
private from npm publication.

## Verify publication

```bash
git ls-remote --tags origin "vX.Y.Z"
test "$(git rev-parse 'vX.Y.Z^{}')" = "$(git rev-parse origin/main)"
gh release view vX.Y.Z --repo limchinhan123/raes-big-ride
```

Finally, open the production URL and the release page in a browser. Confirm the
tag points to the intended `main` commit, the release displays the committed
notes, and production still loads. If a check fails, stop and correct it in a
new commit; do not move or replace a published tag casually.

## Maintainer boundary

Rae's Big Ride is sole-maintained and experimental. A release does not create a
support SLA, compatibility guarantee, or npm package. If release preparation or
documentation used OpenAI Codex, disclose that assistance and retain Brandon
Lim's review and approval of the final release.
