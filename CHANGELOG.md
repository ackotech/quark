# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versions listed here follow the `@quark-hq/quark` CLI version, which is the
version used for repository tags (`v<version>`). Individual packages in the
workspace are versioned independently; their versions at each release are noted
in the entry.

## [Unreleased]

## [0.0.3] - 2026-07-07

First release tracked in this repository. The repository was initialised with
the first public release of Quark, followed by documentation corrections.

### Added

- `@quark-hq/quark` 0.0.3 — CLI for scaffolding pnpm + Nx workspaces
  (`quark new`), creating component packages with Vite or Webpack
  (`quark create`), and local Yalc publish/link/remove workflows.
- `@quark-hq/quark-scripts` 0.0.1 — release automation with interactive version
  bumps and freeze/cascade handling (`release`), alpha publishing to a dev
  registry (`publish-dev`), tag-diff-based production publishing
  (`prod-publish`), and `unfreeze`.
- `@quark-hq/quark-security` 0.0.1 — shared path-confinement, safe-spawn, and
  validation helpers used by all Quark tooling.
- `@quark-hq/atlas` — Next.js app for visualizing package dependency graphs and
  release metadata (not published to npm).
- CI workflow running builds and test coverage for all CLI packages on pull
  requests.
- Project documentation: README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT,
  LICENSE, and NOTICE.

### Changed

- README corrections and a beta status badge after the initial import.
- Code of conduct wording updates.

> Note: `@quark-hq/quark` 0.0.1 (2026-06-30) and 0.0.2 (2026-07-05) were
> published to npm before this repository's history begins, so their changes
> are not tracked here.

[Unreleased]: https://github.com/ackotech/quark/compare/v0.0.3...HEAD
[0.0.3]: https://github.com/ackotech/quark/releases/tag/v0.0.3
