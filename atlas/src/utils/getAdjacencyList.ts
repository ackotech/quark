import { createProjectGraphAsync } from "@nx/devkit";
import { isAtlasTestMode } from "./atlasTestMode";
import {
  mockAdjacencyList,
  mockPackageMetadata,
} from "./mockAtlasData";

type NxDependency = {
  source: string;
  target: string;
  type: string;
};

type NxGraphNodeData = {
  root?: string;
  tags?: string[];
  packageMetadata?: { platform?: string };
};

type NxGraphNode = {
  name?: string;
  data?: NxGraphNodeData;
};

type NxGraph = {
  nodes: Record<string, NxGraphNode>;
  dependencies: Record<string, NxDependency[]>;
};

export type WorkspacePackageMetadata = {
  rootDir: string;
  platform: string;
};

function inferPlatformFromTags(tags?: string[]): string | null {
  if (!tags) return null;
  if (tags.some((t) => t.includes("npm"))) return "node";
  if (tags.some((t) => t.includes("maven"))) return "maven";
  return null;
}

function cloneAdjacency(
  adj: Record<string, string[]>
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(adj).map(([k, v]) => [k, [...v]])
  );
}

/**
 * Workspace adjacency + per-package metadata aligned with quark-scripts
 * {@link NxGraphProvider}: `platform` selects Node vs Maven release adapters.
 */
export async function createWorkspaceGraph(): Promise<{
  adjacency: Record<string, string[]>;
  metadata: Record<string, WorkspacePackageMetadata>;
}> {
  if (isAtlasTestMode()) {
    return {
      adjacency: cloneAdjacency(mockAdjacencyList),
      metadata: { ...mockPackageMetadata },
    };
  }

  const adjList: Record<string, string[]> = {};
  const metadata: Record<string, WorkspacePackageMetadata> = {};

  const graphData = (await createProjectGraphAsync()) as NxGraph;

  for (const [name, node] of Object.entries(graphData.nodes)) {
    if (name.includes("npm:")) continue;
    adjList[name] = [];
    const data = node?.data ?? {};
    const rootDir = typeof data.root === "string" ? data.root : "";
    const platform =
      data.packageMetadata?.platform ??
      inferPlatformFromTags(data.tags) ??
      "unknown";
    metadata[name] = { rootDir, platform };
  }

  for (const [source, deps] of Object.entries(graphData.dependencies)) {
    if (source.includes("npm:")) continue;

    for (const dep of deps) {
      if (dep.target.includes("npm:")) continue;
      if (!adjList[source]) adjList[source] = [];
      adjList[source].push(dep.target);
    }
  }

  return { adjacency: adjList, metadata };
}

export async function createAdjacencyList(): Promise<
  Record<string, string[]>
> {
  const { adjacency } = await createWorkspaceGraph();
  return adjacency;
}

export const reverseAdjacencyList = (
  adjList: Record<string, string[]>
) => {
  const reversedAdjList: Record<string, string[]> = {};
  for (const [node, deps] of Object.entries(adjList)) {
    if (!reversedAdjList[node]) reversedAdjList[node] = [];
    for (const dep of deps) {
      if (!reversedAdjList[dep]) reversedAdjList[dep] = [];
      reversedAdjList[dep].push(node);
    }
  }
  return reversedAdjList;
};
