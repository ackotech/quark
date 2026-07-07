/**
 * Mirrors quark-scripts `resolveWorkspaceDependencySpecifierForFreezeMap`:
 * frozen entries' `pinnedDependencies` for a workspace package win over plain
 * `newVersion` on that package's map entry (major-freeze / cascade scenarios).
 *
 * Atlas returns a display string instead of throwing on conflicting pins (release CLI throws).
 */
export type ReleaseMapLike = Record<
  string,
  {
    baseVersion?: string;
    newVersion?: string;
    frozen?: boolean;
    pinnedDependencies?: Record<string, string>;
  }
>;

export function resolveWorkspacePackageVersionDisplay(
  depName: string,
  packageMap: ReleaseMapLike
): string {
  const fromFrozenPins: string[] = [];
  for (const entry of Object.values(packageMap)) {
    if (entry.frozen !== true || !entry.pinnedDependencies) continue;
    const spec = entry.pinnedDependencies[depName];
    if (typeof spec === "string" && spec.trim().length > 0) {
      fromFrozenPins.push(spec.trim());
    }
  }

  if (fromFrozenPins.length > 0) {
    const unique = [...new Set(fromFrozenPins)];
    if (unique.length > 1) {
      return `${unique[0]} (pin conflict: ${unique.join(" vs ")})`;
    }
    return unique[0];
  }

  const self = packageMap[depName];
  return self?.newVersion ?? self?.baseVersion ?? "unknown";
}
