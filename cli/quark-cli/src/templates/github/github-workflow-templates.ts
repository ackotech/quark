import path from "path";
import {
  existsSyncSafe,
  readFileSyncSafe,
  resolveRelativeNameUnderRoot,
} from "@quark-hq/quark-security";

export type GithubWorkflowFile = {
  filename: string;
  content: string;
};

const WORKFLOW_FILENAMES = [
  "pr-branch-validation.yaml",
  "pr-changelog-comment.yaml",
  "build-and-conflict-checks.yaml",
  "monorepo-release-tagging.yaml",
] as const;

const MARKER = "pr-branch-validation.yaml";

/**
 * Static workflow YAML lives under `src/templates/github/workflows/`.
 * When running from `dist/`, that folder is not emitted by `tsc`, so we resolve from the package root.
 */
export function resolveGithubWorkflowTemplatesDir(): string {
  const nextToModule = path.join(__dirname, "workflows");
  if (
    existsSyncSafe(
      nextToModule,
      resolveRelativeNameUnderRoot(nextToModule, MARKER)
    )
  ) {
    return nextToModule;
  }
  const fromPackageRootViaDist = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "src",
    "templates",
    "github",
    "workflows"
  );
  if (
    existsSyncSafe(
      fromPackageRootViaDist,
      resolveRelativeNameUnderRoot(fromPackageRootViaDist, MARKER)
    )
  ) {
    return fromPackageRootViaDist;
  }
  throw new Error(
    `GitHub workflow templates not found (tried ${nextToModule} and ${fromPackageRootViaDist})`
  );
}

/**
 * Load workflow YAML from disk and substitute `__PNPM_MAJOR__` (pnpm major for `pnpm/action-setup`).
 */
export function loadGithubWorkflowFiles(
  pnpmMajor: string
): GithubWorkflowFile[] {
  const dir = resolveGithubWorkflowTemplatesDir();
  return WORKFLOW_FILENAMES.map((filename) => {
    const safePath = resolveRelativeNameUnderRoot(dir, filename);
    let content = readFileSyncSafe(dir, safePath);
    content = content.replace(/__PNPM_MAJOR__/g, pnpmMajor);
    return { filename, content };
  });
}
