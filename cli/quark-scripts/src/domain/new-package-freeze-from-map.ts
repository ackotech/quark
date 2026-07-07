import type { AdjacencyList } from "./graph";
import type { PackageMap } from "../ports/map";
import { collectTransitiveWorkspaceDependencies } from "./workspace-transitive-dependencies";

export type NewPackageFreezeFromMapResult = {
    /** True when at least one transitive workspace dependency is `frozen` in the map. */
    shouldFreeze: boolean;
    /** Sorted transitive workspace deps that are frozen in `releaseMap`. */
    frozenWorkspaceDependencies: string[];
};

/**
 * For a **new** package (not yet in the release map), determines whether it must be
 * treated as frozen because it depends—directly or transitively—on a workspace
 * package that is already marked `frozen` in `.release/map.json`.
 *
 * When `shouldFreeze` is true, the release flow should set `frozen: true` on the
 * new package so {@link NodeReleaseAdapter.writePackageFiles} pins workspace
 * dependency versions and records `pinnedDependencies` on the map entry.
 */
export function resolveNewPackageFreezeFromReleaseMap(
    packageName: string,
    adjacency: AdjacencyList,
    releaseMap: PackageMap
): NewPackageFreezeFromMapResult {
    const transitive = collectTransitiveWorkspaceDependencies(
        packageName,
        adjacency
    );
    const frozenWorkspaceDependencies = transitive.filter(
        (dep) => releaseMap[dep]?.frozen === true
    );
    return {
        shouldFreeze: frozenWorkspaceDependencies.length > 0,
        frozenWorkspaceDependencies: [...frozenWorkspaceDependencies].sort(),
    };
}
