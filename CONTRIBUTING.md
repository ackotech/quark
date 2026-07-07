<!--
  Licensed under the MIT License. See LICENSE for details.
-->

# Contributing to Quark

Thank you for your interest in contributing to the Quark design-system
boilerplate and tooling. This document explains how to propose changes and
what we expect from contributions.

## Code of Conduct

Participation in this project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).
By contributing, you agree to uphold it.

## Developer Certificate of Origin (DCO)

This project uses the [Developer Certificate of Origin (DCO)](https://developercertificate.org/) instead of a separate CLA.

Every commit must include a `Signed-off-by` line certifying that you wrote the
patch or have the right to submit it under the project license:

```text
Signed-off-by: Your Name <your.email@example.com>
```

Use Git's sign-off flag when committing:

```bash
git commit -s -m "feat: describe your change"
```

## Getting Started

### Prerequisites

- Node.js v20 or later (v18 minimum for CLI consumers per `@quark-hq/quark`)
- [pnpm](https://pnpm.io/installation) 9.x (see `packageManager` in root `package.json`)

### Setup

```bash
git clone https://github.com/ackotech/quark.git
cd quark
pnpm install
```

### Build and Test

```bash
# Build all workspace packages
pnpm run build:all

# Run tests for CLI packages
pnpm --filter @quark-hq/quark run test
pnpm --filter @quark-hq/quark-scripts run test
pnpm --filter @quark-hq/quark-security run test

# Lint and format
pnpm run lint
pnpm run format
```

## How to Contribute

### Reporting Bugs

Open a [GitHub issue](https://github.com/ackotech/quark/issues) with:

- Steps to reproduce
- Expected vs. actual behavior
- Node.js and pnpm versions
- Relevant logs or screenshots

For security issues, follow [SECURITY.md](SECURITY.md) instead of filing a public issue.

### Proposing Features

Open an issue describing the problem, proposed solution, and alternatives
considered. Significant changes (new CLI commands, release workflow changes,
breaking API changes) should be discussed before implementation.

### Pull Requests

1. Fork the repository and create a feature branch from `main`.
2. Make focused changes with clear commit messages.
3. Sign off every commit (`git commit -s`).
4. Add or update tests for behavioral changes.
5. Ensure lint and relevant tests pass.
6. Update documentation when behavior or public APIs change.
7. Open a pull request against `main` with a concise summary and test plan.

### Commit Message Guidelines

Use imperative, descriptive subjects:

```text
feat: add freeze-aware prod publish skip logic
fix: validate package names before scaffold
docs: clarify publish:dev workflow
test: cover topological sort edge cases
```

## Project Structure

| Path | Purpose |
| ---- | ------- |
| `cli/quark-cli` | `@quark-hq/quark` — workspace scaffolding, package creation, Yalc workflows |
| `cli/quark-scripts` | `@quark-hq/quark-scripts` — release, dev publish, prod publish automation |
| `cli/quark-security` | `@quark-hq/quark-security` — shared path and spawn safety helpers |
| `atlas` | `@quark-hq/atlas` — dependency graph and release visualization UI |
| `packages/*` | Component libraries scaffolded by Quark (empty in this boilerplate) |

## Coding Standards

- TypeScript for CLI and tooling code
- Prefer constructor injection and small, testable modules
- Do not bypass `@quark-hq/quark-security` helpers for filesystem or process operations in CLI code
- Keep CLI output user-friendly; use structured logging in scripts where appropriate
- Match existing formatting (Prettier) and lint rules (ESLint)

## Release and Publishing

Release automation lives in `@quark-hq/quark-scripts`. Changes that affect
versioning, registry configuration, or GitHub workflow templates should include
unit tests and notes in the pull request describing migration impact for
downstream workspaces created with `quark create`.

## Questions

Open a GitHub issue with the `question` label or start a discussion in the
repository. Maintainers respond on a best-effort basis; see [README.md](README.md)
for support expectations.
