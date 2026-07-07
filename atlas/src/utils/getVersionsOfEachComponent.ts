import { exec } from "child_process";
import { promisify } from "util";
import { isAtlasTestMode } from "./atlasTestMode";
import { getMockReadMapJsonFromAllTags } from "./mockAtlasData";

const execAsync = promisify(exec);

/* ----------------------------- Types ----------------------------- */

type PackageReleaseInfo = {
  bumpType?: string;
  baseVersion?: string;
  newVersion?: string;
  changeLog?: string;
  oldVersion?: string;
  frozen?: boolean;
  pinnedDependencies?: Record<string, string>;
};

type MapJson = Record<string, PackageReleaseInfo>;

type TagMapJson = {
  tag: string;
  map: MapJson;
};

type PackageVersionEntry = {
  packageName: string;
  tag: string;
  version: string;
};

type GroupedPackageVersions = Record<
  string,
  { tag: string; version: string }[]
>;

/* ---------------------- Read map.json per tag ---------------------- */

export async function readMapJsonFromAllTags(
  filePath = ".release/map.json"
): Promise<TagMapJson[]> {
  if (isAtlasTestMode()) {
    void filePath;
    return getMockReadMapJsonFromAllTags();
  }

  const { stdout } = await execAsync("git tag");

  const tags = stdout
    .split("\n")
    .map(t => t.trim())
    .filter(Boolean)
    // ensure ascending order (older → newer)
    .sort(compareTags);

  const results: TagMapJson[] = [];

  for (const tag of tags) {
    try {
      const { stdout: fileContent } = await execAsync(
        `git show ${tag}:${filePath}`
      );

      results.push({
        tag,
        map: JSON.parse(fileContent) as MapJson,
      });
    } catch {
      // ignore missing map.json
    }
  }

  return results;
}

/* ------------------ Build flat version list ------------------ */

export function buildPackageVersionList(
  tagMaps: TagMapJson[]
): PackageVersionEntry[] {
  const result: PackageVersionEntry[] = [];

  for (const { tag, map } of tagMaps) {
    for (const [packageName, info] of Object.entries(map)) {
      if (!info?.newVersion) continue;

      result.push({
        packageName,
        tag,
        version: info.newVersion,
      });
    }
  }

  return result;
}

/* ------------------ Group + dedupe by version ------------------ */

export function groupByPackageName(
  entries: PackageVersionEntry[]
): GroupedPackageVersions {
  const grouped: GroupedPackageVersions = {};

  for (const entry of entries) {
    if (!grouped[entry.packageName]) {
      grouped[entry.packageName] = [];
    }

    const versionsSeen = new Set(
      grouped[entry.packageName].map(e => e.version)
    );

    // 🔑 If this version already exists, skip later tags
    if (versionsSeen.has(entry.version)) {
      continue;
    }

    grouped[entry.packageName].push({
      tag: entry.tag,
      version: entry.version,
    });
  }

  return grouped;
}

/* ----------------------------- Runner ----------------------------- */

export async function getVersionsOfEachComponent(): Promise<
  GroupedPackageVersions
> {
  const tagMaps = await readMapJsonFromAllTags(".release/map.json");
  const flatList = buildPackageVersionList(tagMaps);
  return groupByPackageName(flatList);
}

/* ------------------ Helpers ------------------ */

/**
 * Very small tag comparator:
 * supports v1.2.3 / 1.2.3 / ana1.0.0
 */
function compareTags(a: string, b: string): number {
  const pa = extractNumbers(a);
  const pb = extractNumbers(b);

  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

function extractNumbers(tag: string): number[] {
  const match = tag.match(/\d+(\.\d+)*/);
  if (!match) return [];
  return match[0].split(".").map(Number);
}
