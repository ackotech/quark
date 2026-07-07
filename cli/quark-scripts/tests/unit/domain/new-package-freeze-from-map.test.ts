import { resolveNewPackageFreezeFromReleaseMap } from "../../../src/domain/new-package-freeze-from-map";
import type { PackageMap, PackageMapEntry } from "../../../src/ports/map";

function entry(overrides: Partial<PackageMapEntry>): PackageMapEntry {
    return {
        bumpType: "patch",
        baseVersion: "1.0.0",
        newVersion: "1.0.1",
        changeLog: "",
        frozen: false,
        ...overrides,
    };
}

describe("resolveNewPackageFreezeFromReleaseMap", () => {
    it("should_notFreeze_whenNoWorkspaceDepsAreFrozen", () => {
        const adjacency = {
            newpkg: ["lib-a"],
            "lib-a": [],
        };
        const map: PackageMap = {
            "lib-a": entry({ frozen: false, newVersion: "2.0.0" }),
        };
        const r = resolveNewPackageFreezeFromReleaseMap("newpkg", adjacency, map);
        expect(r.shouldFreeze).toBe(false);
        expect(r.frozenWorkspaceDependencies).toEqual([]);
    });

    it("should_freeze_whenDirectDepIsFrozen", () => {
        const adjacency = {
            newpkg: ["lib-a"],
            "lib-a": [],
        };
        const map: PackageMap = {
            "lib-a": entry({ frozen: true, newVersion: "3.1.0" }),
        };
        const r = resolveNewPackageFreezeFromReleaseMap("newpkg", adjacency, map);
        expect(r.shouldFreeze).toBe(true);
        expect(r.frozenWorkspaceDependencies).toEqual(["lib-a"]);
    });

    it("should_freeze_whenTransitiveDepIsFrozen", () => {
        const adjacency = {
            newpkg: ["mid"],
            mid: ["frozen-lib"],
            "frozen-lib": [],
        };
        const map: PackageMap = {
            mid: entry({ frozen: false }),
            "frozen-lib": entry({ frozen: true, newVersion: "9.0.0" }),
        };
        const r = resolveNewPackageFreezeFromReleaseMap("newpkg", adjacency, map);
        expect(r.shouldFreeze).toBe(true);
        expect(r.frozenWorkspaceDependencies).toEqual(["frozen-lib"]);
    });

    it("should_ignoreDepsNotInReleaseMap", () => {
        const adjacency = {
            newpkg: ["unmapped-lib"],
            "unmapped-lib": [],
        };
        const map: PackageMap = {};
        const r = resolveNewPackageFreezeFromReleaseMap("newpkg", adjacency, map);
        expect(r.shouldFreeze).toBe(false);
        expect(r.frozenWorkspaceDependencies).toEqual([]);
    });
});
