import path from "path";
import { resolveProjectRoot, safePathInProject } from "../../../src/init/paths";

describe("init/paths", () => {
    describe("resolveProjectRoot", () => {
        it("should_resolve_segment_under_cwd", () => {
            const cwdSpy = jest
                .spyOn(process, "cwd")
                .mockReturnValue("/workspace");

            expect(resolveProjectRoot("my-app")).toBe(
                path.resolve("/workspace", "my-app")
            );

            cwdSpy.mockRestore();
        });

        it("should_throw_when_segment_traverses_outside_cwd", () => {
            const cwdSpy = jest
                .spyOn(process, "cwd")
                .mockReturnValue("/workspace");

            expect(() => resolveProjectRoot("../etc")).toThrow();

            cwdSpy.mockRestore();
        });
    });

    describe("safePathInProject", () => {
        it("should_join_and_assert_under_cwd", () => {
            const cwdSpy = jest
                .spyOn(process, "cwd")
                .mockReturnValue("/workspace");
            const root = path.resolve("/workspace", "proj");

            const p = safePathInProject(root, "packages", "a", "package.json");
            expect(p).toBe(path.resolve("/workspace/proj/packages/a/package.json"));

            cwdSpy.mockRestore();
        });
    });
});
