import type { PackageMap } from "../ports/map";

/**
 * Resolves the semver/range string to write for a workspace dependency when pinning
 * a frozen package's package.json.
 *
 * Prefer versions recorded on **frozen** map entries' `pinnedDependencies` for `depName`
 * (the versions other frozen packages already locked to — e.g. after a major bump, `C`
 * may have `newVersion` `2.0.0` while frozen consumers still pin `C` to `1.x`).
 *
 * If no frozen package pins `depName`, falls back to `packageMap[depName].newVersion`.
 */
export function resolveWorkspaceDependencySpecifierForFreezeMap(
    depName: string,
    packageMap: PackageMap
): string | undefined {
    const fromFrozenPins: string[] = [];
    for (const entry of Object.values(packageMap)) {
        if (entry.frozen !== true || !entry.pinnedDependencies) {
            continue;
        }
        const spec = entry.pinnedDependencies[depName];
        if (spec !== undefined) {
            fromFrozenPins.push(spec);
        }
    }

    if (fromFrozenPins.length > 0) {
        const unique = [...new Set(fromFrozenPins)];
        if (unique.length > 1) {
            throw new Error(
                `Release map: conflicting pinned versions for workspace dependency "${depName}" among frozen packages: ${unique.join(", ")}.`
            );
        }
        return unique[0];
    }

    return packageMap[depName]?.newVersion;
}
