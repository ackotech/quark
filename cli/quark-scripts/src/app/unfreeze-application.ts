import { GraphProvider } from "../ports/graph";
import { ReleaseMapStore } from "../ports/release-map-store";
import { Logger } from "../ports/logger";
import { NodeReleaseAdapter } from "../infrastructure/adapters/node-release-adapter";
import { PackageMap, PackageMapEntry } from "../ports/map";
import { Graph } from "../domain/graph";
import { collectTransitiveWorkspaceDependencies } from "../domain/workspace-transitive-dependencies";
import { UnfreezeBlockedByFrozenDependenciesError } from "../errors/unfreeze-blocked-error";

function resolveReleaseEntry(
    packageName: string,
    localMap: PackageMap,
    mainMap: PackageMap
): PackageMapEntry | undefined {
    if (Object.keys(localMap).length > 0) {
        return localMap[packageName] ?? mainMap[packageName];
    }
    return mainMap[packageName];
}

/** Workspace deps of `packageName` that are still frozen in the release map. */
function frozenTransitiveDependencies(
    packageName: string,
    graph: Graph,
    localMap: PackageMap,
    mainMap: PackageMap
): string[] {
    return collectTransitiveWorkspaceDependencies(
        packageName,
        graph.adjacency
    ).filter((dep) => resolveReleaseEntry(dep, localMap, mainMap)?.frozen === true);
}

/**
 * Unfreezes a package by:
 * 1. Restoring workspace dependency versions to workspace:* in package.json
 * 2. Setting frozen: false in .release/map.json (preserves local manual edits)
 *
 * Proceeds when:
 * - Main has the package frozen (normal unfreeze), OR
 * - Local has the package frozen but main does not (sync to main — repairs stale local state)
 *
 * Refuses to unfreeze while any transitive workspace dependency is still frozen
 * (e.g. A→B→C: unfreeze A only after B (and thus the chain) is unfrozen first).
 */
export class UnfreezeApplication {
    constructor(
        private readonly graphProvider: GraphProvider,
        private readonly releaseMapStore: ReleaseMapStore,
        private readonly nodeReleaseAdapter: NodeReleaseAdapter,
        private readonly logger: Logger,
        private readonly masterBranch: string
    ) {}

    async execute(packageName: string): Promise<void> {
        this.logger.info(`Unfreezing package "${packageName}"...`);

        const graph = await this.graphProvider.build();
        if (!graph || Object.keys(graph.metadata).length === 0) {
            throw new Error("Dependency graph is empty. Ensure you are in a valid monorepo.");
        }

        if (!(packageName in graph.metadata)) {
            throw new Error(`Package "${packageName}" not found in workspace.`);
        }

        // 1. Read main and local maps
        const mainMap = await this.releaseMapStore.read(this.masterBranch);
        const localMap = await this.releaseMapStore.readLocal();
        const baseMap =
            Object.keys(localMap).length > 0 ? { ...localMap } : { ...mainMap };
        const entry = baseMap[packageName] ?? mainMap[packageName];

        if (!entry) {
            throw new Error(
                `Package "${packageName}" not found in release map.`
            );
        }

        // 2. Proceed if frozen on main OR locally (repairs stale local when main already unfrozen)
        const frozenOnMain = mainMap[packageName]?.frozen === true;
        const frozenLocally = entry.frozen === true;
        if (!frozenOnMain && !frozenLocally) {
            throw new Error(
                `Package "${packageName}" is not frozen. Nothing to unfreeze.`
            );
        }

        const blockingDeps = frozenTransitiveDependencies(
            packageName,
            graph,
            localMap,
            mainMap
        );
        if (blockingDeps.length > 0) {
            throw new UnfreezeBlockedByFrozenDependenciesError(
                packageName,
                blockingDeps
            );
        }

        const meta = graph.metadata[packageName];
        if (meta.platform === "maven") {
            throw new Error("Unfreeze for Maven packages is not implemented yet.");
        }

        const workspacePackageNames = new Set<string>(Object.keys(graph.metadata));
        await this.nodeReleaseAdapter.restoreWorkspaceVersions(
            packageName,
            workspacePackageNames
        );

        const { pinnedDependencies: _pinned, ...entryWithoutPins } = entry;
        baseMap[packageName] = { ...entryWithoutPins, frozen: false };
        await this.releaseMapStore.write(baseMap);

        this.logger.success(
            `Unfroze package "${packageName}". Dependency versions restored to workspace:*.`
        );
    }
}
