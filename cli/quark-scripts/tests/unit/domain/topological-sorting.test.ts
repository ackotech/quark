import { TopoSorter } from "../../../src/domain/topological-sorting";

describe("TopoSorter", () => {
    let sorter: TopoSorter;

    beforeEach(() => {
        sorter = new TopoSorter();
    });

    describe("sort", () => {
        it("should_returnCorrectOrder_whenLinearChain", () => {
            // given – A depends on B, B depends on C
            const adjacency = { A: ["B"], B: ["C"], C: [] };

            // when
            const result = sorter.sort(adjacency, ["A", "B", "C"]);

            // then – leaves first: C → B → A
            expect(result.indexOf("C")).toBeLessThan(result.indexOf("B"));
            expect(result.indexOf("B")).toBeLessThan(result.indexOf("A"));
        });

        it("should_returnCorrectOrder_whenDiamondDependency", () => {
            // given – A → B, A → C, B → D, C → D
            const adjacency = {
                A: ["B", "C"],
                B: ["D"],
                C: ["D"],
                D: [],
            };

            // when
            const result = sorter.sort(adjacency, ["A", "B", "C", "D"]);

            // then – D before B and C; B and C before A
            expect(result.indexOf("D")).toBeLessThan(result.indexOf("B"));
            expect(result.indexOf("D")).toBeLessThan(result.indexOf("C"));
            expect(result.indexOf("B")).toBeLessThan(result.indexOf("A"));
            expect(result.indexOf("C")).toBeLessThan(result.indexOf("A"));
        });

        it("should_returnSingleNode_whenOnlyOneProvided", () => {
            // given
            const adjacency = { A: [] };

            // when
            const result = sorter.sort(adjacency, ["A"]);

            // then
            expect(result).toEqual(["A"]);
        });

        it("should_returnEmptyArray_whenNoNodesProvided", () => {
            // given / when
            const result = sorter.sort({}, []);

            // then
            expect(result).toEqual([]);
        });

        it("should_onlyConsiderEdgesWithinNodeSubset", () => {
            // given – full graph A → B → C, but sorting only [A, C]
            const adjacency = { A: ["B"], B: ["C"], C: [] };

            // when
            const result = sorter.sort(adjacency, ["A", "C"]);

            // then – no edge between A and C in this subset
            expect(result).toHaveLength(2);
            expect(result).toContain("A");
            expect(result).toContain("C");
        });

        it("should_handleDisconnectedComponents", () => {
            // given
            const adjacency = { X: [], Y: [], Z: [] };

            // when
            const result = sorter.sort(adjacency, ["X", "Y", "Z"]);

            // then
            expect(result).toHaveLength(3);
            expect(new Set(result)).toEqual(new Set(["X", "Y", "Z"]));
        });

        it("should_handleNodeWithMissingAdjacencyEntry", () => {
            // given – "B" is referenced but has no adjacency key
            const adjacency = { A: ["B"] };

            // when
            const result = sorter.sort(adjacency, ["A", "B"]);

            // then – B has no deps so comes first
            expect(result.indexOf("B")).toBeLessThan(result.indexOf("A"));
        });

        it("should_throwError_whenCycleDetected", () => {
            // given – A → B → C → A
            const adjacency = { A: ["B"], B: ["C"], C: ["A"] };

            // when / then
            expect(() => sorter.sort(adjacency, ["A", "B", "C"])).toThrow(
                /Cycle detected/
            );
        });

        it("should_throwError_whenSelfCycleDetected", () => {
            // given
            const adjacency = { A: ["A"] };

            // when / then
            expect(() => sorter.sort(adjacency, ["A"])).toThrow(
                /Cycle detected involving A/
            );
        });

        it("should_produceDeterministicOutput_regardlessOfInputOrder", () => {
            // given
            const adjacency = { A: ["C"], B: ["C"], C: [] };

            // when
            const result1 = sorter.sort(adjacency, ["A", "B", "C"]);
            const result2 = sorter.sort(adjacency, ["C", "B", "A"]);

            // then
            expect(result1).toEqual(result2);
        });

        it("should_handleComplexGraph_withMultipleLayers", () => {
            // given – a realistic multi-layer graph
            //   ui-button → tokens, utils
            //   ui-card   → ui-button, tokens
            //   theme     → tokens
            const adjacency = {
                "ui-button": ["tokens", "utils"],
                "ui-card": ["ui-button", "tokens"],
                theme: ["tokens"],
                tokens: [],
                utils: [],
            };

            // when
            const result = sorter.sort(adjacency, [
                "ui-button",
                "ui-card",
                "theme",
                "tokens",
                "utils",
            ]);

            // then
            expect(result.indexOf("tokens")).toBeLessThan(
                result.indexOf("ui-button")
            );
            expect(result.indexOf("utils")).toBeLessThan(
                result.indexOf("ui-button")
            );
            expect(result.indexOf("ui-button")).toBeLessThan(
                result.indexOf("ui-card")
            );
            expect(result.indexOf("tokens")).toBeLessThan(
                result.indexOf("theme")
            );
        });
    });
});
