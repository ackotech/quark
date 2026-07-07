/**
 * Returns a topologically sorted array of nodes from an adjacency list using DFS.
 * The adjacency list should be in the form: { [key: string]: string[] }
 * where each key is a node and each value is a list of nodes it depends on.
 */
export function getTopologicalSortedList(adjList: Record<string, string[]>): string[] {
    const visited: Set<string> = new Set();
    const tempMark: Set<string> = new Set();
    const result: string[] = [];

    function visit(node: string) {
        if (tempMark.has(node)) {
            throw new Error("Cycle detected in the dependency graph. Topological sort not possible.");
        }
        if (!visited.has(node)) {
            tempMark.add(node);
            for (const dep of adjList[node] || []) {
                visit(dep);
            }
            tempMark.delete(node);
            visited.add(node);
            result.push(node);
        }
    }

    for (const node of Object.keys(adjList)) {
        if (!visited.has(node)) {
            visit(node);
        }
    }

    return result;
}

