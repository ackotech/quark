/** Same shape as getRootHeight MapJson (kept local to avoid circular imports). */
type MockMapJson = Record<
  string,
  {
    baseVersion?: string;
    newVersion?: string;
    bumpType?: string;
    changeLog?: string;
    frozen?: boolean;
    pinnedDependencies?: Record<string, string>;
  }
>;

type BumpKind = "major" | "minor" | "patch";

function entry(
  newVersion: string,
  bumpType: BumpKind,
  baseVersion = "0.0.0"
): MockMapJson[string] {
  return {
    bumpType,
    baseVersion,
    newVersion,
    changeLog: "",
  };
}

/**
 * Fake Nx graph: forms + shell → button → tokens; shell → icons.
 * Good for exercising top/bottom trees with multiple paths.
 */
export const mockAdjacencyList: Record<string, string[]> = {
  "@demo/ui.shell": ["@demo/ui.button", "@demo/ui.icons"],
  "@demo/ui.forms": ["@demo/ui.button", "@demo/ui.tokens"],
  "@demo/ui.button": ["@demo/ui.tokens"],
  "@demo/ui.tokens": [],
  "@demo/ui.icons": [],
};

/** Mirrors quark-scripts Nx metadata: `platform` drives release adapter routing. */
export const mockPackageMetadata: Record<
  string,
  { rootDir: string; platform: string }
> = {
  "@demo/ui.shell": { rootDir: "packages/shell", platform: "node" },
  "@demo/ui.forms": { rootDir: "packages/forms", platform: "node" },
  "@demo/ui.button": { rootDir: "packages/button", platform: "node" },
  "@demo/ui.tokens": { rootDir: "packages/tokens", platform: "node" },
  /** Example second platform in the same graph (Atlas badge coverage). */
  "@demo/ui.icons": { rootDir: "packages/icons", platform: "maven" },
};

/** Tags in chronological order (must match compareTags ordering in getVersionsOfEachComponent). */
export const MOCK_TAG_ORDER = [
  "v1.0.0",
  "v1.0.1",
  "v1.1.0",
  "v1.2.0",
  "v2.0.0",
  "v2.0.1",
  "v2.1.0",
] as const;

type MockTag = (typeof MOCK_TAG_ORDER)[number];

/**
 * Per-tag release map: mixes patch-only releases, minor trains, and a coordinated major.
 * Versions are chosen so groupByPackageName still surfaces multiple rows per package over time.
 */
const MOCK_MAPS_BY_TAG: Record<MockTag, MockMapJson> = {
  "v1.0.0": {
    "@demo/ui.shell": entry("1.0.0", "minor", "0.9.0"),
    "@demo/ui.button": entry("2.0.0", "minor", "1.9.0"),
    "@demo/ui.tokens": entry("3.0.0", "minor", "2.5.0"),
    "@demo/ui.icons": entry("1.0.0", "major", "0.12.0"),
    "@demo/ui.forms": entry("1.0.0", "minor", "0.8.0"),
  },
  // Patch-only: hotfix tokens + icons; shell/button/forms unchanged (deduped in UI lists).
  "v1.0.1": {
    "@demo/ui.shell": entry("1.0.0", "patch", "1.0.0"),
    "@demo/ui.button": entry("2.0.0", "patch", "2.0.0"),
    "@demo/ui.tokens": entry("3.0.1", "patch", "3.0.0"),
    "@demo/ui.icons": entry("1.0.1", "patch", "1.0.0"),
    "@demo/ui.forms": entry("1.0.0", "patch", "1.0.0"),
  },
  // Minor on shell + button; patch on forms; tokens/icons carry prior patch line.
  "v1.1.0": {
    "@demo/ui.shell": entry("1.1.0", "minor", "1.0.0"),
    "@demo/ui.button": entry("2.1.0", "minor", "2.0.0"),
    "@demo/ui.tokens": entry("3.0.1", "patch", "3.0.1"),
    "@demo/ui.icons": entry("1.0.1", "patch", "1.0.1"),
    "@demo/ui.forms": entry("1.0.1", "patch", "1.0.0"),
  },
  // Another minor wave: tokens minor, shell minor; shows stacked minors across tags.
  "v1.2.0": {
    "@demo/ui.shell": entry("1.2.0", "minor", "1.1.0"),
    "@demo/ui.button": entry("2.1.0", "patch", "2.1.0"),
    "@demo/ui.tokens": entry("3.1.0", "minor", "3.0.1"),
    "@demo/ui.icons": entry("1.1.0", "minor", "1.0.1"),
    "@demo/ui.forms": entry("1.1.0", "minor", "1.0.1"),
  },
  // Coordinated major across the design stack.
  "v2.0.0": {
    "@demo/ui.shell": entry("2.0.0", "major", "1.2.0"),
    "@demo/ui.button": entry("3.0.0", "major", "2.1.0"),
    "@demo/ui.tokens": entry("4.0.0", "major", "3.1.0"),
    "@demo/ui.icons": entry("2.0.0", "major", "1.1.0"),
    "@demo/ui.forms": entry("2.0.0", "major", "1.1.0"),
  },
  // Post-major patch train.
  "v2.0.1": {
    "@demo/ui.shell": entry("2.0.1", "patch", "2.0.0"),
    "@demo/ui.button": entry("3.0.1", "patch", "3.0.0"),
    "@demo/ui.tokens": entry("4.0.1", "patch", "4.0.0"),
    "@demo/ui.icons": entry("2.0.1", "patch", "2.0.0"),
    "@demo/ui.forms": entry("2.0.1", "patch", "2.0.0"),
  },
  // Feature minor on the v2 line.
  "v2.1.0": {
    "@demo/ui.shell": entry("2.1.0", "minor", "2.0.1"),
    "@demo/ui.button": entry("3.1.0", "minor", "3.0.1"),
    "@demo/ui.tokens": entry("4.1.0", "minor", "4.0.1"),
    "@demo/ui.icons": entry("2.1.0", "minor", "2.0.1"),
    "@demo/ui.forms": {
      ...entry("2.1.0", "minor", "2.0.1"),
      frozen: true,
      pinnedDependencies: {
        "@demo/ui.tokens": "3.9.9",
        "@demo/ui.button": "3.0.5",
      },
    },
  },
};

export type MockTagMapJson = { tag: string; map: MockMapJson };

export function getMockReadMapJsonFromAllTags(): MockTagMapJson[] {
  return MOCK_TAG_ORDER.map((tag) => ({
    tag,
    map: { ...MOCK_MAPS_BY_TAG[tag] },
  }));
}

export function mockMapJsonForTag(tag: string): MockMapJson {
  const normalized = tag?.trim() as MockTag;
  if (normalized && normalized in MOCK_MAPS_BY_TAG) {
    return { ...MOCK_MAPS_BY_TAG[normalized as MockTag] };
  }
  const latest = MOCK_TAG_ORDER[MOCK_TAG_ORDER.length - 1];
  return { ...MOCK_MAPS_BY_TAG[latest] };
}

export function getMockPackageVersionsForTag(tag: string): {
  packageName: string;
  version: string;
}[] {
  const map = mockMapJsonForTag(tag);
  return Object.entries(map)
    .filter(([, info]) => Boolean(info?.newVersion))
    .map(([packageName, info]) => ({
      packageName,
      version: info.newVersion as string,
    }));
}
