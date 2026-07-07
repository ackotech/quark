import {
  assertSafeGitRef,
  assertSafeRepoRelativePathForGitShow,
  spawnSyncSafe,
} from "@quark-hq/quark-security";
import { isAtlasTestMode } from "./atlasTestMode";
import { getMockPackageVersionsForTag } from "./mockAtlasData";

type PackageReleaseInfo = {
  bumpType: string;
  baseVersion: string;
  newVersion: string;
  changeLog: string;
  oldVersion?: string;
  frozen?: boolean;
  pinnedDependencies?: Record<string, string>;
};

type MapJson = Record<string, PackageReleaseInfo>;

type PackageVersionAtTag = {
  packageName: string;
  version: string;
};

const GIT_SHOW_MAX_BUFFER = 10 * 1024 * 1024;

/**
 * Returns all package versions for a specific git tag.
 */
export function getPackageVersionsForTag(
  tag: string,
  filePath = ".release/map.json"
): PackageVersionAtTag[] {
  if (isAtlasTestMode()) {
    void filePath;
    return getMockPackageVersionsForTag(tag);
  }

  try {
    assertSafeGitRef(tag, "git tag");
    assertSafeRepoRelativePathForGitShow(filePath, "release map path");
    const revPath = `${tag}:${filePath}`;
    const result = spawnSyncSafe(
      "git",
      ["show", revPath],
      { encoding: "utf8", maxBuffer: GIT_SHOW_MAX_BUFFER }
    );
    if (result.error || result.status !== 0) {
      throw new Error(`git show failed (exit ${String(result.status)})`);
    }
    const fileContent = String(result.stdout ?? "");

    const map = JSON.parse(fileContent) as MapJson;

    return Object.entries(map)
      .filter(([, info]) => Boolean(info?.newVersion))
      .map(([packageName, info]) => ({
        packageName,
        version: info.newVersion,
      }));
  } catch {
    throw new Error(
      `Unable to read ${filePath} for tag "${tag}". ` +
        `Either the tag does not exist or map.json is missing.`
    );
  }
}
