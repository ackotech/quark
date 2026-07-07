import type { SpawnSyncReturns } from "child_process";
import {
    assertSafeExecutableRef,
    assertSafeSpawnArg,
    assertSafeSpawnArgs,
    assertSpawnOk,
    spawnSyncSafe,
} from "../src/spawn";

describe("assertSafeExecutableRef", () => {
    it("should_allow_common_cli_basenames", () => {
        expect(() => assertSafeExecutableRef("npm")).not.toThrow();
        expect(() => assertSafeExecutableRef("pnpm")).not.toThrow();
        expect(() => assertSafeExecutableRef("npx")).not.toThrow();
    });

    it("should_allow_exec_path_with_separators", () => {
        expect(() => assertSafeExecutableRef(process.execPath)).not.toThrow();
    });

    it("should_reject_non_string", () => {
        expect(() => assertSafeExecutableRef(null as unknown as string)).toThrow();
    });

    it("should_reject_empty_or_dangerous", () => {
        expect(() => assertSafeExecutableRef("")).toThrow();
        expect(() => assertSafeExecutableRef("foo;rm")).toThrow();
        expect(() => assertSafeExecutableRef("foo\nbar")).toThrow();
    });

    it("should_reject_path_with_dotdot_segment_after_normalize", () => {
        // Absolute paths like /foo/../bar/bin normalize to /bar/bin (no ".." left).
        // Use a relative path so normalize still contains a ".." segment (e.g. ../bar).
        expect(() => assertSafeExecutableRef("foo/../../bar")).toThrow();
    });

    it("should_reject_too_long", () => {
        expect(() => assertSafeExecutableRef("a".repeat(4097))).toThrow();
    });
});

describe("assertSpawnOk", () => {
    it("should_throw_when_error_present", () => {
        const err = new Error("spawn failed");
        const r = { error: err, status: null } as SpawnSyncReturns<string>;
        expect(() => assertSpawnOk(r, "cmd")).toThrow(err);
    });

    it("should_throw_when_nonzero_exit", () => {
        const r = {
            error: undefined,
            status: 2,
            stdout: "",
            stderr: "",
        } as SpawnSyncReturns<string>;
        expect(() => assertSpawnOk(r, "cmd")).toThrow(/exit 2/);
    });

    it("should_not_throw_when_status_null_and_no_error", () => {
        const r = {
            error: undefined,
            status: null,
            stdout: "",
            stderr: "",
        } as SpawnSyncReturns<string>;
        expect(() => assertSpawnOk(r, "cmd")).not.toThrow();
    });

    it("should_not_throw_on_zero_exit", () => {
        const r = {
            error: undefined,
            status: 0,
            stdout: "",
            stderr: "",
        } as SpawnSyncReturns<string>;
        expect(() => assertSpawnOk(r, "cmd")).not.toThrow();
    });
});

describe("assertSafeSpawnArg", () => {
    it("should_reject_null_byte", () => {
        expect(() => assertSafeSpawnArg("a\0b")).toThrow(/null byte/);
    });
});

describe("assertSafeSpawnArgs", () => {
    it("should_reject_null_byte_in_array", () => {
        expect(() => assertSafeSpawnArgs(["ok", "a\0b"])).toThrow(/null byte/);
    });
});

describe("spawnSyncSafe", () => {
    it("should_invoke_node_version_with_pipe_stdio", () => {
        const r = spawnSyncSafe(process.execPath, ["--version"], {
            encoding: "utf8",
            stdio: "pipe",
        });
        expect(r.status).toBe(0);
        expect(String(r.stdout)).toMatch(/\d+\.\d+/);
    });

    it("should_support_stdio_ignore", () => {
        const r = spawnSyncSafe(process.execPath, ["--version"], {
            stdio: "ignore",
        });
        expect(r.status).toBe(0);
    });
});
