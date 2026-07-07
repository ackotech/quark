import { execFile } from "child_process";
import { promisify } from "util";
import {
    assertSafeGitBranch,
    assertSafeGitRef,
    assertSafeRepoRelativePathForGitShow,
} from "@quark-hq/quark-security";
import { GitService } from "../../ports/git";

const execFileAsync = promisify(execFile);

const GIT_OPTIONS = {
    encoding: "utf8" as const,
    maxBuffer: 50 * 1024 * 1024,
};

async function gitExec(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync("git", args, GIT_OPTIONS);
    return (stdout as string).trim();
}

export class NodeGitService implements GitService {
    private hasCommits: boolean | null = null;

    /* ---------------------------------- */
    /* Repository Info                    */
    /* ---------------------------------- */

    async getRepositoryRoot(): Promise<string> {
        return gitExec(["rev-parse", "--show-toplevel"]);
    }

    async getCurrentBranch(): Promise<string> {
        if (!(await this.repoHasCommits())) {
            return gitExec(["symbolic-ref", "--short", "HEAD"]);
        }

        return gitExec(["rev-parse", "--abbrev-ref", "HEAD"]);
    }

    /* ---------------------------------- */
    /* Remote Operations                  */
    /* ---------------------------------- */

    async fetch(branch: string): Promise<void> {
        assertSafeGitBranch(branch, "branch");
        try {
            await execFileAsync("git", ["fetch", "origin", branch], GIT_OPTIONS);
        } catch {
            // ignore if remote/branch missing
        }
    }

    async commitsBehind(branch: string): Promise<number> {
        assertSafeGitBranch(branch, "branch");
        if (!(await this.repoHasCommits())) return 0;

        try {
            const stdout = await gitExec([
                "rev-list",
                "--count",
                `HEAD..origin/${branch}`,
            ]);

            return parseInt(stdout.trim(), 10) || 0;
        } catch {
            return 0;
        }
    }

    /* ---------------------------------- */
    /* Change Detection                   */
    /* ---------------------------------- */

    async getChangedFiles(baseBranch: string): Promise<string[]> {
        assertSafeGitBranch(baseBranch, "baseBranch");
        if (!(await this.repoHasCommits())) {
            return this.listAllTrackedAndUntracked();
        }

        try {
            const [trackedResult, untrackedResult] = await Promise.allSettled([
                execFileAsync(
                    "git",
                    ["diff", "--name-only", `origin/${baseBranch}`],
                    GIT_OPTIONS
                ),
                execFileAsync(
                    "git",
                    ["ls-files", "--others", "--exclude-standard"],
                    GIT_OPTIONS
                ),
            ]);
            
            // If base branch doesn't exist, fall back to listing ALL tracked files
            let trackedFiles: string[] = [];
            if (trackedResult.status === "fulfilled") {
                trackedFiles = (trackedResult.value.stdout as string)
                    .split("\n")
                    .map(f => f.trim())
                    .filter(Boolean);
            } else {
                // origin/baseBranch doesn't exist — treat every tracked file as changed
                const allTrackedResult = await execFileAsync(
                    "git",
                    ["ls-files"],
                    GIT_OPTIONS
                ).catch(() => ({ stdout: "" }));
            
                trackedFiles = (allTrackedResult.stdout as string)
                    .split("\n")
                    .map(f => f.trim())
                    .filter(Boolean);
            }
            
            const untrackedFiles =
                untrackedResult.status === "fulfilled"
                    ? (untrackedResult.value.stdout as string)
                          .split("\n")
                          .map(f => f.trim())
                          .filter(Boolean)
                    : [];
            
            return [...new Set([...trackedFiles, ...untrackedFiles])];
        } catch {
            return [];
        }
    }

    /* ---------------------------------- */
    /* Helpers                            */
    /* ---------------------------------- */

    private async repoHasCommits(): Promise<boolean> {
        if (this.hasCommits !== null) {
            return this.hasCommits;
        }

        try {
            await execFileAsync("git", ["rev-parse", "HEAD"], GIT_OPTIONS);
            this.hasCommits = true;
        } catch {
            this.hasCommits = false;
        }

        return this.hasCommits;
    }

    private async listAllTrackedAndUntracked(): Promise<string[]> {
        try {
            const stdout = await gitExec([
                "ls-files",
                "--others",
                "--exclude-standard",
            ]);

            return stdout
                .split("\n")
                .map(f => f.trim())
                .filter(Boolean);
        } catch {
            return [];
        }
    }

    /* ---------------------------------- */
    /* File Reading                       */
    /* ---------------------------------- */

    async readFile(path: string, branch: string): Promise<string> {
        assertSafeGitBranch(branch, "branch");
        assertSafeRepoRelativePathForGitShow(path, "path");
        const spec = `origin/${branch}:${path}`;
        return gitExec(["show", spec]);
    }

    async readFileFromRef(filePath: string, ref: string): Promise<string> {
        assertSafeGitRef(ref, "ref");
        assertSafeRepoRelativePathForGitShow(filePath, "filePath");
        const spec = `${ref}:${filePath}`;
        return gitExec(["show", spec]);
    }

    /* ---------------------------------- */
    /* Tag Operations                     */
    /* ---------------------------------- */

    async getTags(targetTag?: string): Promise<[string | null, string]> {
        const stdout = await gitExec(["tag", "--sort=-creatordate"]);
        const tags = stdout.trim().split("\n").filter(Boolean);

        if (tags.length === 0) {
            throw new Error("No git tags found.");
        }

        if (targetTag) {
            assertSafeGitRef(targetTag, "targetTag");
            const targetIndex = tags.indexOf(targetTag);
            if (targetIndex === -1) {
                throw new Error(`Tag "${targetTag}" not found.`);
            }

            const previousTag = tags[targetIndex + 1];
            if (!previousTag) {
                return [null, targetTag];
            }

            assertSafeGitRef(previousTag, "previousTag");
            return [previousTag, targetTag];
        }

        if (tags.length === 1) {
            assertSafeGitRef(tags[0]!, "latestTag");
            return [null, tags[0]!];
        }

        assertSafeGitRef(tags[1]!, "previousTag");
        assertSafeGitRef(tags[0]!, "latestTag");
        return [tags[1]!, tags[0]!];
    }
}
