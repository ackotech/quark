import { UnfreezeBlockedByFrozenDependenciesError } from "../../../src/errors/unfreeze-blocked-error";

describe("UnfreezeBlockedByFrozenDependenciesError", () => {
    it("should_exposeSortedBlockingPackages_andSummaryMessage", () => {
        const err = new UnfreezeBlockedByFrozenDependenciesError("app-a", [
            "lib-c",
            "lib-b",
            "lib-c",
        ]);
        expect(err.requestedPackage).toBe("app-a");
        expect([...err.blockingPackages]).toEqual(["lib-b", "lib-c"]);
        expect(err.message).toContain("app-a");
        expect(err.message).toContain("lib-b");
        expect(err.message).toContain("lib-c");
    });

    it("should_renderCliWithBlockingList", () => {
        const err = new UnfreezeBlockedByFrozenDependenciesError("app-a", ["lib-b"]);
        const out = err.renderCli();
        expect(out).toContain("Unfreeze blocked");
        expect(out).toContain("app-a");
        expect(out).toContain("lib-b");
        expect(out).toContain("quark unfreeze");
    });
});
