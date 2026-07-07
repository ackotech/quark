import { Graph } from "../domain/graph";
import { PlatformReleaseAdapter } from "../ports/platform-release-adapter";
import { TopoSorter } from "../domain/topological-sorting";
import { PromptResult } from "../ports/prompts";
import { ReleaseMapStore } from "../ports/release-map-store";
import { PackageMap } from "../ports/map";
import { Logger } from "../ports/logger";
import { GitService } from "../ports/git";
import { GraphProvider } from "../ports/graph";
import { BaseApplication } from "./base-application";

export class ReleaseApplication extends BaseApplication {
    constructor(
        logger: Logger,
        git: GitService,
        graphProvider: GraphProvider,
        private readonly adapters: PlatformReleaseAdapter[],
        private readonly topoSorter: TopoSorter,
        private readonly releaseMapStore: ReleaseMapStore,
        masterBranch: string = "main"
    ) {
        super(logger, git, graphProvider, masterBranch);
    }

    async execute(): Promise<void> {
        this.logger.info("Performing repository checks...");
        const repoRoot = await this.ensureRepositoryHealthy();

        this.logger.info("Building dependency graph...");
        const graph = await this.buildGraph();

        this.logger.success("Repository checks passed");
        
        this.logger.info(
            `Total packages: ${Object.keys(graph.adjacency).length}`
        );

        const changedFiles = await this.getChangedAbsolutePaths(repoRoot);
        this.logger.info(`Changed files: ${changedFiles.length}`);

        const affected = this.resolveDirectlyChangedPackages(
            changedFiles,
            graph.metadata
        );
        this.logger.info(`Affected packages: ${[...affected].join(", ")}`);

        const sorted = this.topoSorter.sort(graph.adjacency, [...affected]);
        this.logger.info(`Execution order: ${sorted.join(" → ")}`);

        await this.executeRelease([...affected], graph, sorted);
    }

    // ── Affected-package resolution ────────────────────────────────────

    /**
     * Only packages whose files changed. Dependents are not included here;
     * when the user chooses a **major** bump for a package, the release adapter
     * adds direct dependents (freeze / cascade) via {@link BaseReleaseAdapter}.
     */
    private resolveDirectlyChangedPackages(
        changedFiles: string[],
        metadata: Record<string, { rootDir: string; platform: string }>
    ): Set<string> {
        return this.mapFilesToPackages(changedFiles, metadata);
    }

    // ── Release orchestration ──────────────────────────────────────────

    private async executeRelease(
        affected: string[],
        graph: Graph,
        sorted: string[]
    ): Promise<void> {
        const existingMap =
            await this.releaseMapStore.readMergedWithLocal(this.masterBranch);

        const allPrompts = await this.collectPrompts(
            affected,
            graph,
            sorted,
            existingMap
        );

        await this.writePromptResults(allPrompts, graph, existingMap);
        await this.releaseMapStore.write(existingMap);
    }

    private async collectPrompts(
        affected: string[],
        graph: Graph,
        sorted: string[],
        existingMap: PackageMap
    ): Promise<Record<string, PromptResult>> {
        const grouped = this.groupByAdapter(affected, graph);
        let allPrompts: Record<string, PromptResult> = {};

        for (const [adapter, packages] of grouped.entries()) {
            this.logger.info(
                `Executing adapter for ${packages.length} package(s)`
            );
            const adapterPrompts = await adapter.execute(
                packages,
                graph,
                sorted,
                existingMap
            );
            allPrompts = { ...allPrompts, ...adapterPrompts };
        }

        return allPrompts;
    }

    private async writePromptResults(
        allPrompts: Record<string, PromptResult>,
        graph: Graph,
        mapJsonObject: PackageMap
    ): Promise<void> {
        for (const [pkg, prompt] of Object.entries(allPrompts)) {
            const meta = graph.metadata[pkg];
            if (!meta) continue;

            const adapter = this.adapters.find((a) => a.supports(meta));
            if (!adapter) {
                this.logger.warn(`No adapter found for ${pkg}`);
                continue;
            }

            await adapter.writeUserPromptsToFiles(
                pkg,
                prompt,
                mapJsonObject,
                graph
            );
        }
    }

    private groupByAdapter(
        affected: string[],
        graph: Graph
    ): Map<PlatformReleaseAdapter, string[]> {
        const grouped = new Map<PlatformReleaseAdapter, string[]>();

        for (const pkg of affected) {
            const meta = graph.metadata[pkg];
            if (!meta) continue;

            const adapter = this.adapters.find((a) => a.supports(meta));
            if (!adapter) {
                this.logger.warn(`No adapter found for ${pkg}`);
                continue;
            }

            if (!grouped.has(adapter)) {
                grouped.set(adapter, []);
            }
            grouped.get(adapter)!.push(pkg);
        }

        return grouped;
    }
}
