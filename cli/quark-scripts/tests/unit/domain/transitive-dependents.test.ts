import { collectTransitiveDependents } from "../../../src/domain/transitive-dependents";

describe("collectTransitiveDependents", () => {
    it("should_returnEmpty_whenNoDependents", () => {
        const inverted = {
            lib: [],
        };

        expect(collectTransitiveDependents("lib", inverted)).toEqual([]);
    });

    it("should_includeDirectAndTransitiveConsumers_inLinearChain", () => {
        // package-a → package-b → package-c (edges in adjacency); inverted:
        const inverted = {
            "package-c": ["package-b"],
            "package-b": ["package-a"],
            "package-a": [],
        };

        const result = collectTransitiveDependents("package-c", inverted);

        expect(new Set(result)).toEqual(new Set(["package-b", "package-a"]));
        expect(result).toHaveLength(2);
    });

    it("should_deduplicate_whenDiamond", () => {
        const inverted = {
            D: ["B", "C"],
            B: ["A"],
            C: ["A"],
            A: [],
        };

        const result = collectTransitiveDependents("D", inverted);

        expect(new Set(result)).toEqual(new Set(["B", "C", "A"]));
        expect(result).toHaveLength(3);
    });

    it("should_handleCycles_withoutInfiniteLoop", () => {
        const inverted: Record<string, string[]> = {
            X: ["Y"],
            Y: ["X"],
        };

        const result = collectTransitiveDependents("X", inverted);

        expect(new Set(result)).toEqual(new Set(["Y"]));
    });
});
