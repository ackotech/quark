import {
    assertPathInsideRoot,
    assertSafePathSegment,
    resolveRelativeNameUnderRoot,
    resolveUnderWorkspaceRoot,
} from "../src/paths";

describe("assertPathInsideRoot", () => {
    it("should_allow_paths_inside_root", () => {
        const root = "/repo";
        expect(assertPathInsideRoot(root, "/repo/pkg")).toBe("/repo/pkg");
    });

    it("should_reject_escape_via_dotdot", () => {
        expect(() =>
            assertPathInsideRoot("/repo", "/repo/../etc/passwd")
        ).toThrow();
    });
});

describe("assertSafePathSegment", () => {
    it("should_reject_dotdot", () => {
        expect(() => assertSafePathSegment("..", "name")).toThrow();
    });

    it("should_reject_empty", () => {
        expect(() => assertSafePathSegment("", "name")).toThrow();
    });

    it("should_reject_leading_whitespace", () => {
        expect(() => assertSafePathSegment(" x", "name")).toThrow();
    });

    it("should_reject_null_byte", () => {
        expect(() => assertSafePathSegment("a\0b", "name")).toThrow();
    });

    it("should_reject_absolute_path", () => {
        const abs =
            process.platform === "win32" ? "C:\\absolute\\name" : "/abs";
        expect(() => assertSafePathSegment(abs, "name")).toThrow();
    });
});

describe("resolveRelativeNameUnderRoot", () => {
    it("should_resolve_safe_segment_under_root", () => {
        const root = "/repo";
        expect(resolveRelativeNameUnderRoot(root, "pkg-a")).toBe("/repo/pkg-a");
    });

    it("should_reject_traversal_segment", () => {
        expect(() =>
            resolveRelativeNameUnderRoot("/repo", "../etc")
        ).toThrow();
    });
});

describe("resolveUnderWorkspaceRoot", () => {
    it("should_resolve_workspace_relative_project_root", () => {
        expect(resolveUnderWorkspaceRoot("/repo", "packages/foo")).toBe(
            "/repo/packages/foo"
        );
    });

    it("should_allow_dot_for_workspace_root", () => {
        expect(resolveUnderWorkspaceRoot("/repo", ".")).toBe("/repo");
    });

    it("should_reject_dotdot_segments", () => {
        expect(() =>
            resolveUnderWorkspaceRoot("/repo", "packages/../..")
        ).toThrow();
    });
});
