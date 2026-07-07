import { collectTransitiveWorkspaceDependencies } from "../../../src/domain/workspace-transitive-dependencies";

describe("collectTransitiveWorkspaceDependencies", () => {
    it("should_returnEmpty_whenPackageHasNoDeps", () => {
        const adjacency = {
            app: [],
            lib: ["app"],
        };
        expect(collectTransitiveWorkspaceDependencies("app", adjacency)).toEqual([]);
    });

    it("should_includeDirectAndTransitiveDeps_inChain", () => {
        const adjacency = {
            "package-a": ["package-b"],
            "package-b": ["package-c"],
            "package-c": [],
        };
        const result = collectTransitiveWorkspaceDependencies("package-a", adjacency);
        expect(result).toEqual(["package-b", "package-c"]);
    });

    it("should_deduplicate_whenDiamond", () => {
        const adjacency = {
            A: ["B", "C"],
            B: ["D"],
            C: ["D"],
            D: [],
        };
        const result = collectTransitiveWorkspaceDependencies("A", adjacency);
        expect(new Set(result)).toEqual(new Set(["B", "C", "D"]));
        expect(result).toHaveLength(3);
    });

    it("should_handleCycles_withoutInfiniteLoop", () => {
        const adjacency: Record<string, string[]> = {
            X: ["Y"],
            Y: ["X"],
        };
        const result = collectTransitiveWorkspaceDependencies("X", adjacency);
        expect(result).toEqual(["Y"]);
    });
});
