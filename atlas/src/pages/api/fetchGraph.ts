import type { NextApiRequest, NextApiResponse } from "next";
import {
  createWorkspaceGraph,
  reverseAdjacencyList,
  type WorkspacePackageMetadata,
} from "@utils/getAdjacencyList";
import { getTopologicalSortedList } from "@utils/getTopologicalSortedList";
import { getBottomTree, getTopTree } from "@utils/getRootHeight";
import { isAtlasTestMode } from "@utils/atlasTestMode";
import { assertSafeGitRef, spawnSyncSafe } from "@quark-hq/quark-security";

type ResponseData = {
  data: unknown;
};

let adjacencyList: Record<string, string[]> = {};
let reversedAdjacencyList: Record<string, string[]> = {};
let topologicalSortedList: string[] = [];
let packageMetadata: Record<string, WorkspacePackageMetadata> = {};

function executionOrderForSubgraph(
  globalTopo: string[],
  nodesInView: Set<string>
): string[] {
  return globalTopo.filter((p) => nodesInView.has(p));
}

function ghAuthOk(): boolean {
  const r = spawnSyncSafe("gh", ["auth", "status"], { stdio: "ignore" });
  return !r.error && r.status === 0;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  try {
    const testMode = isAtlasTestMode();
    if (
      testMode ||
      Object.keys(adjacencyList).length === 0 ||
      Object.keys(packageMetadata).length === 0
    ) {
      const built = await createWorkspaceGraph();
      adjacencyList = built.adjacency;
      packageMetadata = built.metadata;
      reversedAdjacencyList = reverseAdjacencyList(adjacencyList);
      try {
        topologicalSortedList = getTopologicalSortedList(adjacencyList);
      } catch (e) {
        console.warn("Atlas: topological sort failed (cycle?)", e);
        topologicalSortedList = Object.keys(adjacencyList);
      }
    }

    const releaseNote: Record<string, string> = {};
    if (testMode) {
      releaseNote["body"] =
        "Mock release notes (ATLAS_TEST_MODE). GitHub CLI is not used in test mode.";
      if (req.query.tag) {
        releaseNote["body"] += ` Selected tag: ${req.query.tag}`;
      }
    } else {
      try {
        if (!ghAuthOk()) {
          throw new Error("GitHub CLI not configured");
        }
        if (req.query.tag) {
          try {
            const tagStr = String(req.query.tag);
            assertSafeGitRef(tagStr, "release tag");
            const view = spawnSyncSafe(
              "gh",
              [
                "release",
                "view",
                tagStr,
                "--json",
                "body",
                "--jq",
                ".body",
              ],
              { encoding: "utf-8" }
            );
            if (view.error || view.status !== 0) {
              releaseNote["body"] = "";
            } else {
              releaseNote["body"] = String(view.stdout ?? "").trim();
            }
          } catch {
            releaseNote["body"] = "";
          }
        }
      } catch {
        releaseNote["err"] = "Github CLI not configured";
      }
    }

    const packageName = (req.query.packageName as string) ?? "";
    const tag = (req.query.tag as string) ?? "";

    const bottomTree = await getBottomTree(
      packageName,
      adjacencyList,
      reversedAdjacencyList,
      tag
    );
    const topTree = await getTopTree(
      packageName,
      adjacencyList,
      reversedAdjacencyList,
      tag
    );

    const nodesInView = new Set([
      ...Object.keys(bottomTree),
      ...Object.keys(topTree),
    ]);
    const releaseExecutionOrder = executionOrderForSubgraph(
      topologicalSortedList,
      nodesInView
    );

    res.status(200).json({
      data: {
        bottomTree,
        topTree,
        releaseNote,
        packageMetadata,
        /** Same topological direction as quark-scripts release (deps before dependents). */
        releaseExecutionOrder,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ data: "Error fetching graph or release map" });
  }
}
