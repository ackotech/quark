import path from "path";
import * as quarkSecurity from "@quark-hq/quark-security";
import {
    loadGithubWorkflowFiles,
    resolveGithubWorkflowTemplatesDir,
} from "../../../src/templates/github/github-workflow-templates";

describe("github-workflow-templates", () => {
    describe("resolveGithubWorkflowTemplatesDir", () => {
        it("should_resolve_templates_next_to_module", () => {
            const dir = resolveGithubWorkflowTemplatesDir();

            expect(dir).toContain(path.join("templates", "github", "workflows"));
            expect(
                quarkSecurity.existsSyncSafe(
                    dir,
                    path.join(dir, "pr-branch-validation.yaml")
                )
            ).toBe(true);
        });

        it("should_fallback_to_src_when_dist_layout", () => {
            const existsSpy = jest
                .spyOn(quarkSecurity, "existsSyncSafe")
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(true);

            const dir = resolveGithubWorkflowTemplatesDir();

            expect(dir).toContain(
                path.join("src", "templates", "github", "workflows")
            );
            expect(existsSpy).toHaveBeenCalledTimes(2);

            existsSpy.mockRestore();
        });

        it("should_throw_when_templates_missing", () => {
            const existsSpy = jest
                .spyOn(quarkSecurity, "existsSyncSafe")
                .mockReturnValue(false);

            expect(() => resolveGithubWorkflowTemplatesDir()).toThrow(
                /GitHub workflow templates not found/
            );

            existsSpy.mockRestore();
        });
    });

    describe("loadGithubWorkflowFiles", () => {
        it("should_load_all_workflow_files", () => {
            const files = loadGithubWorkflowFiles("9");

            expect(files).toHaveLength(4);
            expect(files.map((f) => f.filename).sort()).toEqual([
                "build-and-conflict-checks.yaml",
                "monorepo-release-tagging.yaml",
                "pr-branch-validation.yaml",
                "pr-changelog-comment.yaml",
            ]);
            for (const file of files) {
                expect(file.content.length).toBeGreaterThan(0);
            }
        });

        it("should_substitute_pnpm_major_placeholder", () => {
            const readSpy = jest
                .spyOn(quarkSecurity, "readFileSyncSafe")
                .mockReturnValue("pnpm-version: __PNPM_MAJOR__\n");

            const files = loadGithubWorkflowFiles("42");

            expect(files[0].content).toBe("pnpm-version: 42\n");
            expect(files[0].content).not.toContain("__PNPM_MAJOR__");

            readSpy.mockRestore();
        });
    });
});
