/** External CLIs validated via spawn (no shell). */
export const ALLOWED_EXTERNAL_COMMANDS = new Set(["pnpm", "yalc"]);

export const MIN_NODE_MAJOR = 18;

export const PACKAGE_MANAGER_PIN = "pnpm@9.14.2";

/** Root workspace production dependencies (pnpm add -w). TypeScript is not added at workspace root. */
export const ROOT_PROD_DEPENDENCIES = [
    "concurrently",
    "glob",
    "husky",
    "prompts",
    "rimraf",
    "semver",
] as const;

/** npm package name for the workspace scripts CLI (must match `cli/quark-scripts` package.json `name`). */
export const QUARK_SCRIPTS_NPM_PACKAGE = "@quark-hq/quark-scripts";

/** Root workspace dev dependencies (pnpm add -w -D). `@acko/quark-scripts` is appended at install time with a pinned version. */
export const ROOT_DEV_DEPENDENCIES = ["dotenv", "nx"] as const;

export const PNPM_WORKSPACE_YAML = `packages:
  - packages/**
  - apps/**
`;

export const DEFAULT_NPMRC = "";

/** Workspace root .gitignore lines (init flow). */
export const WORKSPACE_GITIGNORE_LINES = [
    "node_modules",
    "dist",
    ".DS_Store",
    ".env",
    ".next",
    "logs",
    "coverage",
    "storybook-static",
    "output.json",
    "*.log",
    ".yalc",
    ".nx/cache",
    ".nx/workspace-data",
    "yalc.lock",
    ".npmrc",
] as const;

/** Standalone .gitignore (createGitignore). */
export const STANDALONE_GITIGNORE_LINES = [
    ".nx/cache",
    ".nx/workspace-data",
    "node_modules",
    "dist/",
    ".DS_Store",
    ".yalc",
    "storybook-static",
    "output.json",
    ".prettierrc",
    "yalc.lock",
    ".env",
    ".npmrc",
] as const;

export const DEFAULT_DOTENV_KEYS = [
    "SCOPE",
    "DEV_REGISTRY_URL",
    "DEV_AUTH_TOKEN",
    "DEV_NPM_ALWAYS_AUTH",
    "PROD_REGISTRY_URL",
    "PROD_AUTH_TOKEN",
    "PROD_NPM_ALWAYS_AUTH",
] as const;

export const ROOT_PACKAGE_SCRIPTS: Record<string, string> = {
    storybook: "pnpm --filter=./apps/storybook run storybook",
    graph: "nx graph",
    "build:all":
        "npx nx run-many -t build --parallel=3",
    "lint-fix": "eslint . --fix",
    test: 'echo "Error: no test specified" && exit 1',
    lint: "eslint .",
    format: "prettier --write .",
    release: "quark-scripts release",
    "publish:dev": "quark-scripts publish:dev",
};

/**
 * Root image for the Quark pnpm + Nx monorepo scaffold (`apps/storybook`, `packages/**`).
 * Registry URLs for prod publish are read from `.env` by `quark-scripts` (see DEFAULT_DOTENV_KEYS).
 */
export const DOCKERFILE_TEMPLATE = `
FROM node:20.16.0-bookworm-slim

# git: tags + history for \`quark-scripts prod-publish\` (map diff between tags).
# Optional: add \`awscli\` if your pipeline needs AWS CLI in this layer.
RUN apt-get update \\
    && apt-get install -y --no-install-recommends git ca-certificates \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Nx must not try to start the daemon in Docker.
ENV NX_DAEMON=false

# Match the scaffold’s pinned pnpm (see PACKAGE_MANAGER_PIN in this repo).
RUN corepack enable && corepack prepare ${PACKAGE_MANAGER_PIN} --activate

# Copy the full workspace. Include \`.git\` in the build context when you need prod-publish
# (e.g. \`docker build --progress=plain .\` from a clone with tags).
# Private registry installs: provide \`.npmrc\` (and/or \`.env\`) in the context — they are gitignored by default;
# use CI secrets, BuildKit \`--secret\`, or \`docker compose\` \`env_file\` as appropriate.
COPY . .

RUN if [ -f .npmrc ]; then echo "Using project .npmrc"; else echo "No .npmrc in context — private installs may fail without registry auth"; fi

RUN pnpm install --frozen-lockfile || pnpm install

RUN pnpm run build:all

RUN echo "Git tags (for prod-publish):" && (git tag --sort=-creatordate 2>/dev/null | head -20 || true)

# Publishes changed packages from \`.release/map.json\` between the two latest tags (see \`quark-scripts prod-publish\`).
# Uses \`DEV_REGISTRY_URL\` / \`PROD_REGISTRY_URL\` (and related vars) from \`.env\` when present.
RUN pnpm exec quark-scripts prod-publish || echo "⚠️ prod-publish skipped or failed (e.g. fewer than two tags, no map diff, or registry auth)."

EXPOSE 6006

# Storybook lives at \`apps/storybook\`; path filter avoids relying on the package \`name\` field.
WORKDIR /usr/src/app
CMD ["pnpm", "--filter", "./apps/storybook", "run", "storybook"]
`.trim();
