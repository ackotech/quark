import {
    assertSafeGitBranch,
    assertSafeGitRef,
    assertSafeRepoRelativePathForGitShow,
} from "../src/git";

describe("assertSafeGitBranch", () => {
    it("should_allow_main", () => {
        expect(() => assertSafeGitBranch("main", "branch")).not.toThrow();
    });

    it("should_reject_empty", () => {
        expect(() => assertSafeGitBranch("", "branch")).toThrow();
    });

    it("should_reject_shell_metacharacters", () => {
        expect(() =>
            assertSafeGitBranch("main;rm -rf /", "branch")
        ).toThrow();
    });

    it("should_reject_invalid_format", () => {
        expect(() => assertSafeGitBranch("-bad", "branch")).toThrow();
    });
});

describe("assertSafeGitRef", () => {
    it("should_allow_tag", () => {
        expect(() => assertSafeGitRef("v1.0.0", "ref")).not.toThrow();
    });

    it("should_reject_empty", () => {
        expect(() => assertSafeGitRef("", "ref")).toThrow();
    });

    it("should_reject_colon", () => {
        expect(() => assertSafeGitRef("ref:path", "ref")).toThrow();
    });

    it("should_reject_invalid_format", () => {
        expect(() => assertSafeGitRef("-x", "ref")).toThrow();
    });
});

describe("assertSafeRepoRelativePathForGitShow", () => {
    it("should_allow_release_map", () => {
        expect(() =>
            assertSafeRepoRelativePathForGitShow(".release/map.json", "p")
        ).not.toThrow();
    });

    it("should_reject_dotdot", () => {
        expect(() =>
            assertSafeRepoRelativePathForGitShow("..", "p")
        ).toThrow();
    });

    it("should_reject_empty", () => {
        expect(() => assertSafeRepoRelativePathForGitShow("", "p")).toThrow();
    });

    it("should_reject_absolute", () => {
        expect(() =>
            assertSafeRepoRelativePathForGitShow("/abs", "p")
        ).toThrow();
    });

    it("should_reject_colon", () => {
        expect(() =>
            assertSafeRepoRelativePathForGitShow("foo:bar", "p")
        ).toThrow();
    });
});
