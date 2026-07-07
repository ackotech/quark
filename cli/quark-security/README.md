# @quark-hq/quark-security

Shared validation, path-safety, and process-spawn helpers for the Quark CLI toolchain. Prevents path traversal, validates npm package names and git refs, and wraps `child_process.spawnSync` with safe argument handling.

Part of the [Quark](https://github.com/ackotech/quark) project. Consumed by [`@quark-hq/quark`](https://www.npmjs.com/package/@quark-hq/quark) and [`@quark-hq/quark-scripts`](https://www.npmjs.com/package/@quark-hq/quark-scripts).

## Requirements

- Node.js **18+**

## Install

```bash
npm install @quark-hq/quark-security
# or
pnpm add @quark-hq/quark-security
```

## Usage

```typescript
import {
  assertPathInsideRoot,
  writeFileSyncSafe,
  spawnSyncSafe,
  assertSpawnOk,
  assertValidNpmPackageName,
} from "@quark-hq/quark-security";

const root = process.cwd();
const safePath = assertPathInsideRoot(root, "/some/candidate/path");

writeFileSyncSafe(root, safePath, "content", "utf8");

assertValidNpmPackageName("my-package", "package name");

const result = spawnSyncSafe("git", ["status"], { cwd: root });
assertSpawnOk(result, "git status");
```

## API overview

| Area | Exports |
| ---- | ------- |
| **Paths** | `assertPathInsideRoot`, `resolveUnderWorkspaceRoot`, `resolveRelativeNameUnderRoot`, `assertSafePathSegment` |
| **Filesystem** | `existsSyncSafe`, `mkdirSyncSafe`, `readFileSyncSafe`, `writeFileSyncSafe`, `rmSyncSafe`, … |
| **Spawn** | `spawnSyncSafe`, `assertSpawnOk`, `assertSafeSpawnArgs`, … |
| **npm** | `validateNpmPackageName`, `assertValidNpmPackageName` |
| **Git** | `assertSafeGitBranch`, `assertSafeGitRef`, `assertSafeRepoRelativePathForGitShow` |
| **Logging** | `formatErrorMessage`, `shouldLogErrorStack`, `stripUrlCredentials` |

## Development

```bash
pnpm install
pnpm --filter @quark-hq/quark-security run build
pnpm --filter @quark-hq/quark-security run test
```

## License

MIT © Acko Technologies
