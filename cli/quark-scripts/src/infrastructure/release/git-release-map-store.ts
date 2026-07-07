import { ReleaseMapStore } from "../../ports/release-map-store";
import { PackageMap, PackageMapEntry } from "../../ports/map";
import { GitService } from "../../ports/git";
import path from "path";
import fs from "fs/promises";
import { assertPathInsideRoot } from "@quark-hq/quark-security";

/** Shallow-merge per package: local fields override main (same key set as unfreeze + release). */
export function mergeReleaseMaps(main: PackageMap, local: PackageMap): PackageMap {
    const keys = new Set([
        ...Object.keys(main),
        ...Object.keys(local),
    ]);
    const merged: PackageMap = {};
    for (const pkg of keys) {
        merged[pkg] = {
            ...(main[pkg] ?? {}),
            ...(local[pkg] ?? {}),
        } as PackageMapEntry;
    }
    return merged;
}

export class GitReleaseMapStore implements ReleaseMapStore {
    constructor(private readonly git: GitService) {}

    async read(masterBranch: string): Promise<PackageMap> {
        try {
            const raw = await this.git.readFile(
                ".release/map.json",
                masterBranch
            );
            return JSON.parse(raw);
        } catch {
            return {};
        }
    }

    async readLocal(): Promise<PackageMap> {
        try {
            const cwd = process.cwd();
            const mapPath = assertPathInsideRoot(
                cwd,
                path.resolve(cwd, ".release", "map.json")
            );
            const raw = await fs.readFile(mapPath, "utf8");
            return JSON.parse(raw);
        } catch {
            return {};
        }
    }

    async readMergedWithLocal(masterBranch: string): Promise<PackageMap> {
        const [main, local] = await Promise.all([
            this.read(masterBranch),
            this.readLocal(),
        ]);
        return mergeReleaseMaps(main, local);
    }

    async write(map: PackageMap): Promise<void> {
        const cwd = process.cwd();
        const releaseDir = assertPathInsideRoot(
            cwd,
            path.resolve(cwd, ".release")
        );
        await fs.mkdir(releaseDir, { recursive: true });
        await fs.writeFile(
            path.join(releaseDir, "map.json"),
            JSON.stringify(map, null, 2),
            "utf8"
        );
    }
}
