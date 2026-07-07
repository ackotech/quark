import { join } from "path";
import { readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import {
    assertSpawnOk,
    resolveUnderWorkspaceRoot,
    spawnSyncSafe,
} from "@quark-hq/quark-security";
import { GraphProvider, NxGraphOutput, NxProjectGraph } from "../../ports/graph";
import { Graph } from "../../domain/graph";

export class NxGraphProvider implements GraphProvider {
    private graph: NxProjectGraph = <NxProjectGraph>{};

    constructor(private readonly workspaceRoot: string = process.cwd()) {}

    async build(): Promise<Graph> {
        const raw = this.runNxGraph();
        const nx = JSON.parse(raw) as NxGraphOutput;
        this.graph = nx.graph;
        const adjacency: Record<string, string[]> = {};
        const metadata: Record<string, { rootDir: string; platform: string }> = {};

        for (const [source, deps] of Object.entries(nx.graph.dependencies)) {
            adjacency[source] = deps.map(d => d.target);
        }

        for (const [name, node] of Object.entries(nx.graph.nodes)) {
            // bearer:disable javascript_lang_path_traversal
            const rootDir = resolveUnderWorkspaceRoot(
                this.workspaceRoot,
                node.data.root
            );

            const platform =
                node.data.packageMetadata?.platform ??
                this.inferPlatformFromTags(node.data.tags) ??
                "unknown";

            metadata[name] = { rootDir, platform };
        }

        return { adjacency, metadata };
    }

    private runNxGraph(): string {
        const tmpFile = join(tmpdir(), `nx-graph-${Date.now()}.json`);
        try {
            const r = spawnSyncSafe(
                "npx",
                ["--yes", "nx", "graph", "--file", tmpFile],
                {
                    cwd: this.workspaceRoot || process.cwd(),
                    stdio: "pipe",
                    maxBuffer: 50 * 1024 * 1024,
                }
            );
            assertSpawnOk(r, "npx nx graph");
            return readFileSync(tmpFile, "utf-8");
        } finally {
            try { unlinkSync(tmpFile); } catch { /* already cleaned up */ }
        }
    }

    private inferPlatformFromTags(tags?: string[]): string | null {
        if (!tags) return null;

        if (tags.some(t => t.includes("npm"))) return "node";
        if (tags.some(t => t.includes("maven"))) return "maven";

        return null;
    }

    async getInvertedAdjacencyList(adjacency: Record<string, string[]>): Promise<Record<string, string[]>> {
        const inverted: Record<string, string[]> = {};

        // Initialize all keys
        for (const node of Object.keys(adjacency)) {
            inverted[node] = [];
        }

        // Reverse edges
        for (const [node, deps] of Object.entries(adjacency)) {
            for (const dep of deps) {
                if (!inverted[dep]) {
                    inverted[dep] = [];
                }
                inverted[dep].push(node);
            }
        }
        return inverted;
    }

    async getPackageJson(pkg: string): Promise<string> {
    const node = this.graph.nodes[pkg];
    if (!node) {
        throw new Error(`Package "${pkg}" not found in graph`);
    }
    return node.data.root;
    }
}