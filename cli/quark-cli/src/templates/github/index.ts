import { PACKAGE_MANAGER_PIN } from "../../init/constants";
import { loadGithubWorkflowFiles, type GithubWorkflowFile } from "./github-workflow-templates";

export type { GithubWorkflowFile };

function pnpmMajorForActionSetup(): string {
    const m = /^pnpm@(\d+)/.exec(PACKAGE_MANAGER_PIN);
    return m?.[1] ?? "9";
}

/**
 * Workflow YAML copied into new projects by `quark new` (sources under `src/templates/github/workflows/`).
 */
export function getGithubWorkflowFiles(): readonly GithubWorkflowFile[] {
    return loadGithubWorkflowFiles(pnpmMajorForActionSetup());
}
