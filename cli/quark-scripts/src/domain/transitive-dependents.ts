import type { AdjacencyList } from "./graph";

/**
 * Collect every project that transitively consumes `rootPkg`: direct dependents,
 * then dependents of those nodes, using the inverted dependency graph
 * (consumer → [] of projects they depend on is NOT this structure).
 *
 * `invertedAdjacencyList[x]` = project names that **depend on** x (Nx-style).
 */
export function collectTransitiveDependents(
    rootPkg: string,
    invertedAdjacencyList: AdjacencyList
): string[] {
    const seen = new Set<string>();
    const queue = (invertedAdjacencyList[rootPkg] ?? []).filter(
        (n) => n !== rootPkg
    );

    while (queue.length > 0) {
        const node = queue.shift()!;
        if (node === rootPkg || seen.has(node)) continue;
        seen.add(node);
        for (const next of invertedAdjacencyList[node] ?? []) {
            if (next !== rootPkg && !seen.has(next)) queue.push(next);
        }
    }

    return [...seen];
}
