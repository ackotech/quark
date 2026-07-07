import { AdjacencyList } from "./graph";

export class TopoSorter {
  /**
   * DFS-based topological sort.
   * Only considers edges within the provided node subset.
   */
  sort(
    adjacency: AdjacencyList,
    nodes: string[]
  ): string[] {
    const nodeSet = new Set(nodes);

    const visited = new Set<string>();
    const temp = new Set<string>();
    const result: string[] = [];

    const visit = (node: string): void => {
      if (visited.has(node)) return;

      if (temp.has(node)) {
        throw new Error(`Cycle detected involving ${node}`);
      }

      temp.add(node);

      const neighbors = adjacency[node] || [];

      // deterministic order
      const filteredNeighbors = neighbors
        .filter(n => nodeSet.has(n))
        .sort();

      for (const neighbor of filteredNeighbors) {
        visit(neighbor);
      }

      temp.delete(node);
      visited.add(node);
      result.push(node);
    };

    // deterministic root traversal
    const sortedNodes = [...nodes].sort();

    for (const node of sortedNodes) {
      if (!visited.has(node)) {
        visit(node);
      }
    }

    return result;
  }
}