import { exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { join } from "path";
import { isAtlasTestMode } from "./atlasTestMode";
import { mockMapJsonForTag } from "./mockAtlasData";
import {
  resolveWorkspacePackageVersionDisplay,
  type ReleaseMapLike,
} from "./resolveWorkspaceVersionFromMap";

const execAsync = promisify(exec);

/* ========================================================================
   TYPES
======================================================================== */

export type PackageReleaseInfo = {
  baseVersion?: string;
  newVersion?: string;
  bumpType?: string;
  /** When true, release pins workspace deps; Atlas resolves versions using all frozen entries' `pinnedDependencies` (same rules as quark-scripts release). */
  frozen?: boolean;
  pinnedDependencies?: Record<string, string>;
};

export type MapJson = Record<string, PackageReleaseInfo>;

export type VersionedRef = {
  name: string;
  version: string;
};

export type TopTreeNode = {
  height: number;
  version: string;
  /** True when this package is marked `frozen` in map.json for the selected tag. */
  frozen: boolean;
  childNodes: VersionedRef[];
};

export type BottomTreeNode = {
  height: number;
  version: string;
  frozen: boolean;
  parentNodes: VersionedRef[];
};

/* ========================================================================
   MAP.JSON READER
======================================================================== */

export async function getMapJsonForTag(tag: string): Promise<MapJson> {
    if (isAtlasTestMode()) {
      return mockMapJsonForTag(tag) as MapJson;
    }

    const trimmed = typeof tag === "string" ? tag.trim() : "";
    const revPath = trimmed
      ? `${trimmed}:.release/map.json`
      : "HEAD:.release/map.json";

    try {
      const { stdout } = await execAsync(`git show ${revPath}`, {
        maxBuffer: 10 * 1024 * 1024,
      });
      return JSON.parse(stdout);
    } catch {
      try {
        const raw = await readFile(
          join(process.cwd(), ".release", "map.json"),
          "utf8"
        );
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
  }

/* ========================================================================
   TOP TREE (DEPENDENTS / UPWARD)
======================================================================== */

export async function getTopTree(
  root: string,
  adjacencyList: Record<string, string[]>,
  reverseAdjacencyList: Record<string, string[]>,
  tag: string
): Promise<Record<string, TopTreeNode>> {
  const output: Record<
    string,
    { height: number; childNodes: Set<string> }
  > = {};

  const queue: [string, number, string[]][] = [[root, 0, []]];
  const versionInfo = await getMapJsonForTag(tag);

  while (queue.length > 0) {
    const [currentNode, currentHeight, children] = queue.shift()!;

    if (!output[currentNode]) {
      output[currentNode] = {
        height: currentHeight,
        childNodes: new Set(children),
      };
    } else {
      // keep closest-to-root
      output[currentNode].height = Math.min(
        output[currentNode].height,
        currentHeight
      );
      children.forEach((c) => output[currentNode].childNodes.add(c));
    }

    const parents = reverseAdjacencyList[currentNode] ?? [];
    for (const parent of parents) {
      queue.push([parent, currentHeight - 1, [...children, currentNode]]);
    }
  }

  const mapLike = versionInfo as ReleaseMapLike;

  return Object.fromEntries(
    Object.entries(output).map(([pkg, v]) => [
      pkg,
      {
        height: v.height,
        version: resolveWorkspacePackageVersionDisplay(pkg, mapLike),
        frozen: versionInfo[pkg]?.frozen === true,
        childNodes: [...v.childNodes].map((child) => ({
          name: child,
          version: resolveWorkspacePackageVersionDisplay(child, mapLike),
        })),
      },
    ])
  );
}

/* ========================================================================
   BOTTOM TREE (DEPENDENCIES / DOWNWARD)
======================================================================== */

export async function getBottomTree(
  root: string,
  adjacencyList: Record<string, string[]>,
  reverseAdjacencyList: Record<string, string[]>,
  tag: string
): Promise<Record<string, BottomTreeNode>> {
  const output: Record<
    string,
    { height: number; parentNodes: Set<string> }
  > = {};

  const queue: [string, number, string[]][] = [[root, 0, []]];
  const versionInfo = await getMapJsonForTag(tag);

  while (queue.length > 0) {
    const [currentNode, currentHeight, parents] = queue.shift()!;

    if (!output[currentNode]) {
      output[currentNode] = {
        height: currentHeight,
        parentNodes: new Set(parents),
      };
    } else {
      // keep deepest dependency depth
      output[currentNode].height = Math.max(
        output[currentNode].height,
        currentHeight
      );
      parents.forEach((p) => output[currentNode].parentNodes.add(p));
    }

    const deps = adjacencyList[currentNode] ?? [];
    for (const dep of deps) {
      queue.push([dep, currentHeight + 1, [...parents, currentNode]]);
    }
  }

  const mapLike = versionInfo as ReleaseMapLike;

  return Object.fromEntries(
    Object.entries(output).map(([pkg, v]) => [
      pkg,
      {
        height: v.height,
        version: resolveWorkspacePackageVersionDisplay(pkg, mapLike),
        frozen: versionInfo[pkg]?.frozen === true,
        parentNodes: [...v.parentNodes].map((parent) => ({
          name: parent,
          version: resolveWorkspacePackageVersionDisplay(parent, mapLike),
        })),
      },
    ])
  );
}
