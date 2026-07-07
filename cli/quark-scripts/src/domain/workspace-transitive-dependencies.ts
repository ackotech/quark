import type { AdjacencyList } from "./graph";

/**
 * All workspace packages transitively depended on by `pkg` (walk `adjacency`
 * from `pkg` toward its dependencies). Only includes names that appear as keys
 * in `adjacency` (workspace projects).
 */
export function collectTransitiveWorkspaceDependencies(
    pkg: string,
    adjacency: AdjacencyList
): string[] {
    const seen = new Set<string>();
    const stack = (adjacency[pkg] ?? []).filter((n) => n !== pkg);

    while (stack.length > 0) {
        const dep = stack.pop()!;
        if (!(dep in adjacency) || dep === pkg || seen.has(dep)) {
            continue;
        }
        seen.add(dep);
        for (const next of adjacency[dep] ?? []) {
            if (next !== pkg && !seen.has(next)) {
                stack.push(next);
            }
        }
    }
    return [...seen].sort();
}
