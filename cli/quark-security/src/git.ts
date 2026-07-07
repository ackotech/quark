const MAX_REF_LEN = 256;

/** Git branch / simple ref names (e.g. main, feature/foo). */
const BRANCH_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9._/-]*[a-zA-Z0-9])?$/;

/**
 * Tags, full SHAs, short SHAs, refs like refs/tags/v1.0.0.
 * Conservative ASCII set; rejects shell metacharacters and path tricks.
 */
const GIT_REF_PATTERN =
    /^[a-zA-Z0-9]([a-zA-Z0-9._^~/@+-]*[a-zA-Z0-9])?$/;

function hasForbiddenSequences(s: string): boolean {
    return (
        s.includes("..") ||
        s.includes("\n") ||
        s.includes("\r") ||
        s.includes("\0") ||
        s.includes("`") ||
        s.includes("$") ||
        s.includes(";") ||
        s.includes("|") ||
        s.includes("&") ||
        s.includes("(") ||
        s.includes(")") ||
        s.includes("<") ||
        s.includes(">") ||
        s.includes("*") ||
        s.includes("?") ||
        s.includes("[") ||
        s.includes("]") ||
        s.includes("\\") ||
        s.includes("\"") ||
        s.includes("'") ||
        s.includes(" ") ||
        s.includes(":") // ref:path separator; ref must not contain ':'
    );
}

export function assertSafeGitBranch(branch: string, label: string): void {
    if (!branch || branch.length > MAX_REF_LEN) {
        throw new Error(`Invalid ${label}: length or empty`);
    }
    if (hasForbiddenSequences(branch)) {
        throw new Error(`Invalid ${label}: forbidden characters`);
    }
    if (!BRANCH_PATTERN.test(branch)) {
        throw new Error(`Invalid ${label}: format`);
    }
}

export function assertSafeGitRef(ref: string, label: string): void {
    if (!ref || ref.length > MAX_REF_LEN) {
        throw new Error(`Invalid ${label}: length or empty`);
    }
    if (hasForbiddenSequences(ref)) {
        throw new Error(`Invalid ${label}: forbidden characters`);
    }
    if (!GIT_REF_PATTERN.test(ref)) {
        throw new Error(`Invalid ${label}: format`);
    }
}

/**
 * Path used in `git show <ref>:<path>` (repo-relative, POSIX-style segments).
 */
export function assertSafeRepoRelativePathForGitShow(
    relativePath: string,
    label: string
): void {
    if (!relativePath || relativePath.length > 4096) {
        throw new Error(`Invalid ${label}: length or empty`);
    }
    if (relativePath.startsWith("/") || relativePath.startsWith("\\")) {
        throw new Error(`Invalid ${label}: must be relative`);
    }
    if (relativePath.includes("\0") || relativePath.includes(":")) {
        throw new Error(`Invalid ${label}: forbidden characters`);
    }
    const parts = relativePath.split(/[/\\]/);
    for (const p of parts) {
        if (p === "..") {
            throw new Error(`Invalid ${label}: must not contain '..'`);
        }
    }
}
