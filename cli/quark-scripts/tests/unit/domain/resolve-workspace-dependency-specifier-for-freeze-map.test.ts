import { resolveWorkspaceDependencySpecifierForFreezeMap } from "../../../src/domain/resolve-workspace-dependency-specifier-for-freeze-map";
import type { PackageMap, PackageMapEntry } from "../../../src/ports/map";

function entry(
    partial: Partial<PackageMapEntry> & Pick<PackageMapEntry, "newVersion">
): PackageMapEntry {
    return {
        bumpType: "patch",
        baseVersion: "1.0.0",
        changeLog: "",
        frozen: false,
        ...partial,
    };
}

describe("resolveWorkspaceDependencySpecifierForFreezeMap", () => {
    it("should_returnNewVersion_whenNoFrozenPackagePinsDep", () => {
        const map: PackageMap = {
            tokens: entry({ newVersion: "2.0.0", frozen: false }),
        };
        expect(
            resolveWorkspaceDependencySpecifierForFreezeMap("tokens", map)
        ).toBe("2.0.0");
    });

    it("should_preferPinnedVersionFromFrozenConsumer_whenNewVersionDiffers", () => {
        const map: PackageMap = {
            B: entry({
                frozen: true,
                newVersion: "1.0.0",
                pinnedDependencies: { C: "1.0.0" },
            }),
            C: entry({
                frozen: false,
                newVersion: "2.0.0",
                changeLog: "major",
            }),
        };
        expect(resolveWorkspaceDependencySpecifierForFreezeMap("C", map)).toBe(
            "1.0.0"
        );
    });

    it("should_returnPinnedVersionForA_whenFrozenB_pinsA", () => {
        const map: PackageMap = {
            A: entry({ frozen: true, newVersion: "5.0.0" }),
            B: entry({
                frozen: true,
                newVersion: "2.0.0",
                pinnedDependencies: { A: "4.2.0" },
            }),
        };
        expect(resolveWorkspaceDependencySpecifierForFreezeMap("A", map)).toBe(
            "4.2.0"
        );
    });

    it("should_throw_whenFrozenPackagesPinConflictingVersions", () => {
        const map: PackageMap = {
            X: entry({
                frozen: true,
                pinnedDependencies: { C: "1.0.0" },
                newVersion: "1.0.0",
            }),
            Y: entry({
                frozen: true,
                pinnedDependencies: { C: "2.0.0" },
                newVersion: "1.0.0",
            }),
            C: entry({ newVersion: "3.0.0", frozen: false }),
        };
        expect(() =>
            resolveWorkspaceDependencySpecifierForFreezeMap("C", map)
        ).toThrow(/conflicting pinned versions/);
    });

    it("should_returnUndefined_whenDepUnknown", () => {
        const map: PackageMap = {};
        expect(
            resolveWorkspaceDependencySpecifierForFreezeMap("missing", map)
        ).toBeUndefined();
    });
});
