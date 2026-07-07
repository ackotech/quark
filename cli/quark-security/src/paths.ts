import path from "path";

/**
 * Resolves `candidate` and throws if it is not under `root` (after normalization).
 * Prevents path traversal via `..` or symlinks escaping the root when combined with realpath callers.
 */
export function assertPathInsideRoot(root: string, candidate: string): string {
    // bearer:disable javascript_lang_path_traversal
    const resolvedRoot = path.resolve(root);
    // bearer:disable javascript_lang_path_traversal
    const resolved = path.resolve(candidate);
    const rel = path.relative(resolvedRoot, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
        throw new Error(
            `Path is outside allowed root: ${candidate}`
        );
    }
    return resolved;
}

/**
 * Ensures a path segment used as a single folder/package name under cwd cannot escape upward.
 */
/**
 * Resolves a single path segment (e.g. package or project name) under root and rejects traversal.
 */
export function resolveRelativeNameUnderRoot(root: string, name: string): string {
    assertSafePathSegment(name, "path");
    // bearer:disable javascript_lang_path_traversal
    const resolved = path.resolve(root, name);
    return assertPathInsideRoot(root, resolved);
}

/**
 * Resolves a workspace-relative directory (e.g. Nx `project.data.root` like `packages/foo` or `.`)
 * under `workspaceRoot` and rejects traversal outside the workspace.
 */
export function resolveUnderWorkspaceRoot(
    workspaceRoot: string,
    relativePath: string
): string {
    if (typeof relativePath !== "string" || relativePath.includes("\0")) {
        throw new Error("Invalid relative path");
    }
    const trimmed = relativePath.trim();
    if (trimmed === "" || trimmed === ".") {
        return assertPathInsideRoot(workspaceRoot, path.resolve(workspaceRoot));
    }
    const normalized = path.normalize(trimmed);
    if (normalized.split(/[/\\]/).includes("..")) {
        throw new Error("Relative path must not contain '..'");
    }
    // bearer:disable javascript_lang_path_traversal
    const joined = path.resolve(workspaceRoot, trimmed);
    return assertPathInsideRoot(workspaceRoot, joined);
}

export function assertSafePathSegment(segment: string, label: string): void {
    if (!segment || segment.trim() !== segment) {
        throw new Error(`${label} must be a non-empty string without leading or trailing whitespace`);
    }
    if (segment.includes("\0")) {
        throw new Error(`${label} contains invalid characters`);
    }
    if (path.isAbsolute(segment)) {
        throw new Error(`${label} must be a relative name, not an absolute path`);
    }
    const normalized = path.normalize(segment);
    if (normalized.split(path.sep).some((p) => p === "..")) {
        throw new Error(`${label} must not contain '..'`);
    }
}
