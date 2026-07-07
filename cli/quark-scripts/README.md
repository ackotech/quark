# @quark-hq/quark-scripts

Release and publish automation for Quark monorepos — interactive version bumps, dev-registry alpha publishes, production publishes from `.release/map.json`, and package unfreezing.

Used by workspaces scaffolded with [`@quark-hq/quark`](https://www.npmjs.com/package/@quark-hq/quark). Part of the [Quark](https://github.com/ackotech/quark) project.

## Requirements

- Node.js **18+**
- A Quark-style monorepo with Nx, `quark-config.json`, and `.release/map.json`
- Registry credentials in `.env` (see scaffolded `DEFAULT_DOTENV_KEYS`)

## Install

```bash
npm install -g @quark-hq/quark-scripts
# or as a workspace dev dependency (recommended)
pnpm add -D @quark-hq/quark-scripts
```

## Commands

| Command | Description |
| ------- | ----------- |
| `quark-scripts release` | Interactive release — bump versions, update map, pin frozen workspace dependencies |
| `quark-scripts publish-dev` | Publish a changed package to the dev registry as an alpha version |
| `quark-scripts prod-publish` | Publish changed packages to production based on `map.json` diff between git tags |
| `quark-scripts prod-publish --tag <tag>` | Compare against a specific git tag instead of the latest |
| `quark-scripts unfreeze <package-name>` | Restore a frozen package's deps to `workspace:*` |

Root `package.json` scripts in scaffolded projects typically include:

```json
{
  "release": "quark-scripts release",
  "publish:dev": "quark-scripts publish:dev"
}
```

## Configuration

- **`.env`** — `DEV_REGISTRY_URL`, `PROD_REGISTRY_URL`, auth tokens, etc.
- **`quark-config.json`** — branch name, registry URLs, publish settings
- **`.release/map.json`** — per-package versions, changelogs, freeze state

## Related packages

| Package | Role |
| ------- | ---- |
| [`@quark-hq/quark`](https://www.npmjs.com/package/@quark-hq/quark) | Workspace scaffolding CLI |
| [`@quark-hq/quark-security`](https://www.npmjs.com/package/@quark-hq/quark-security) | Shared path and spawn safety helpers |

## Development

```bash
pnpm install
pnpm --filter @quark-hq/quark-scripts run build
pnpm --filter @quark-hq/quark-scripts run test
```

## License

MIT © Acko Technologies
