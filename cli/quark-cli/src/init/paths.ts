import path from "path";
import { assertPathInsideRoot, resolveRelativeNameUnderRoot } from "@quark-hq/quark-security";

/** Current workspace directory (CLI cwd) for path containment checks. */
export const workspaceRoot = (): string => process.cwd();

/**
 * Resolves a validated project folder under the current working directory (segment = project name).
 */
export function resolveProjectRoot(projectSegment: string): string {
    return resolveRelativeNameUnderRoot(workspaceRoot(), projectSegment);
}

/**
 * Joins path segments under the project root and ensures the result stays under the workspace cwd.
 */
export function safePathInProject(
    projectRoot: string,
    ...segments: string[]
): string {
    return assertPathInsideRoot(
        workspaceRoot(),
        path.resolve(projectRoot, ...segments)
    );
}
