# Releasing Quark

This document describes how to cut a release of this repository. Quark ships
its own release tooling (`@quark-hq/quark-scripts`), and that tooling is the
canonical path — do not hand-edit versions or publish packages ad hoc.

## Overview

A release has four stages:

1. **Version bump + release map** — `quark-scripts release` (interactive)
2. **Changelog + tag** — update `CHANGELOG.md`, create and push `v<version>`
3. **GitHub Release** — `gh release create` with notes from the changelog
4. **Publish** — `quark-scripts prod-publish` diffs the release map between the
   two most recent tags and publishes changed packages to the registry

Repository tags follow the `@quark-hq/quark` CLI version: `v<version>`
(e.g. `v0.0.3`). Individual workspace packages are versioned independently;
the release map records each package's version at the release point.

## Prerequisites

- You are on `main` (see `release.masterBranch` in `quark-config.json`) with a
  clean working tree and the latest commits pulled.
- Registry credentials are configured in `.env` (see keys in
  `cli/quark-cli/src/init/constants.ts`). Never commit these.
- Dependencies installed and packages built:

  ```bash
  pnpm install
  pnpm run build:all
  ```

## 1. Run the release

```bash
pnpm run release        # runs: quark-scripts release
```

This walks the changed packages interactively:

- Prompts for a version bump (patch/minor/major) per package.
- On a **major** bump, asks whether to cascade the bump to dependent packages,
  freeze them at their current versions, or selectively freeze. Frozen
  packages are recorded with `frozen: true` and skipped by `prod-publish`
  until released with `quark-scripts unfreeze <package-name>`.
- Writes every decision to `.release/map.json` — this file is the source of
  truth that makes production publishes deterministic.

Commit the version bumps and the release map:

```bash
git add .release/map.json '**/package.json' CHANGELOG.md
git commit -m "release: v<version>"
git push -u origin <release-branch>
```

Merge to `main` via pull request (CI must pass).

## 2. Update the changelog and tag

Before tagging, move the `[Unreleased]` items in [CHANGELOG.md](CHANGELOG.md)
into a new `[<version>] - <YYYY-MM-DD>` section and update the comparison
links at the bottom of the file (this can be part of the release PR above).

Then tag the merge commit on `main`:

```bash
git checkout main && git pull origin main
git tag v<version>
git push origin v<version>
```

`prod-publish` resolves tags sorted by creation date, so the tag must exist
before publishing.

## 3. Create the GitHub Release

```bash
gh release create v<version> --title "v<version>" \
  --notes "See CHANGELOG.md: https://github.com/ackotech/quark/blob/main/CHANGELOG.md"
```

Prefer pasting the changelog section for this version into the notes
(`--notes-file`), so the Releases page is self-contained.

## 4. Publish to the registry

```bash
npx quark-scripts prod-publish            # or: --tag v<version> to target a specific tag
```

`prod-publish`:

- Diffs `.release/map.json` between the latest tag and the previous one (the
  first release uses an empty baseline).
- Skips frozen packages and map-only updates that don't change a version.
- Topologically sorts changed packages so dependencies publish first.
- Checks whether each version already exists in the registry before
  publishing, so re-runs are safe and duplicates are impossible.
- Restores original `package.json` / `.npmrc` state on failure.

### Alpha builds (optional, any time)

```bash
npx quark-scripts publish-dev             # publishes an alpha version to the dev registry
```

## Configuration

Release behavior is controlled by `quark-config.json` (`excludePackages`,
`autoCommit`, `masterBranch`, `freeze`). Registry URLs and auth tokens are
read from `.env` at publish time.
