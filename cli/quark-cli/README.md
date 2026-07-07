# @quark-hq/quark

CLI for scaffolding and working with Quark design-system monorepos — pnpm + Nx workspaces, GitHub Actions workflows, Storybook, and local [Yalc](https://github.com/wclr/yalc) publishing.

Part of the [Quark](https://github.com/ackotech/quark) project.

## Requirements

- Node.js **18+**
- `pnpm` and `yalc` (installed automatically on first run if missing)

## Install

```bash
npm install -g @quark-hq/quark
# or
pnpm add -g @quark-hq/quark
```

## Commands

| Command | Description |
| ------- | ----------- |
| `quark new <project-name>` | Bootstrap a new monorepo (pnpm workspace, GitHub workflows, sample button package, Storybook, `.env`, Dockerfile) |
| `quark create <package-name>` | Scaffold a new React library package (Vite or Webpack) in the current workspace |
| `quark publish <package-name>` | Publish a package to the local Yalc store |
| `quark publish <package-name> --push` | Publish and push to linked consumers |
| `quark link <package-name>` | Publish via Yalc and link into the current project |
| `quark remove <package-name>` | Remove a Yalc-linked package |
| `quark remove --all` | Remove all Yalc-linked packages |
| `quark add-atlas [dir]` | Copy the bundled Atlas (Next.js) app into the workspace (`--force` to overwrite) |

## Examples

```bash
# New monorepo
quark new my-design-system
cd my-design-system

# Add a component package
quark create my-button

# Local dev publish
quark publish my-button --push
```

## Related packages

| Package | Role |
| ------- | ---- |
| [`@quark-hq/quark-scripts`](https://www.npmjs.com/package/@quark-hq/quark-scripts) | Release, dev publish, and prod publish automation |
| [`@quark-hq/quark-security`](https://www.npmjs.com/package/@quark-hq/quark-security) | Path-safety and spawn helpers used by the CLIs |

## Development

From the [Quark monorepo](https://github.com/ackotech/quark):

```bash
pnpm install
pnpm --filter @quark-hq/quark run build
pnpm --filter @quark-hq/quark run test
```

## License

MIT © Acko Technologies
