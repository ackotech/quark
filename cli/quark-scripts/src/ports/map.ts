export interface PackageMapEntry {
  bumpType: "patch" | "minor" | "major" | "new"; // assuming possible types
  baseVersion: string;
  newVersion: string;
  changeLog: string;
  frozen: boolean;
  /**
   * When `frozen` is true: every workspace package in this package's dependency closure
   * (direct and transitive per the Nx graph) → exact semver (or range string) used for
   * that dependency at freeze time (from {@link resolveWorkspaceDependencySpecifierForFreezeMap}).
   * Direct deps are also written to package.json; transitive-only deps appear here only.
   */
  pinnedDependencies?: Record<string, string>;
}

export interface PackageMap {
  [packageName: string]: PackageMapEntry;
}