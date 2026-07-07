import fs from "fs";
import os from "os";
import path from "path";
import * as quarkSecurity from "@quark-hq/quark-security";
import {
    getGitRoot,
    getNxProjectPath,
    readPackageJson,
    replaceWorkspaceVersions,
    runYalcPublish,
    runYalcPublishWithPush,
    writePackageJson,
} from "../../../src/yalc/utils";

jest.mock("@quark-hq/quark-security", () => {
    const actual = jest.requireActual<typeof import("@quark-hq/quark-security")>(
        "@quark-hq/quark-security"
    );
    return {
        ...actual,
        spawnSyncSafe: jest.fn(),
        readFileSyncSafe: jest.fn(),
        writeFileSyncSafe: jest.fn(),
    };
});

const spawnSyncSafeMock = jest.mocked(quarkSecurity.spawnSyncSafe);
const readFileSyncSafeMock = jest.mocked(quarkSecurity.readFileSyncSafe);
const writeFileSyncSafeMock = jest.mocked(quarkSecurity.writeFileSyncSafe);

describe("yalc/utils", () => {
    let tmpRoot: string;

    beforeEach(() => {
        jest.clearAllMocks();
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "quark-yalc-"));
        jest.spyOn(process, "cwd").mockReturnValue(tmpRoot);
    });

    afterEach(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
        jest.restoreAllMocks();
    });

    describe("replaceWorkspaceVersions", () => {
        it("should_replace_workspace_prefix_with_star", () => {
            const deps = {
                a: "workspace:*",
                b: "^1.0.0",
            };
            replaceWorkspaceVersions(deps);
            expect(deps).toEqual({ a: "*", b: "^1.0.0" });
        });

        it("should_noop_when_deps_undefined", () => {
            expect(() => replaceWorkspaceVersions(undefined)).not.toThrow();
        });

        it("should_skip_keys_without_workspace_prefix", () => {
            const deps = { x: "1.0.0" };
            replaceWorkspaceVersions(deps);
            expect(deps.x).toBe("1.0.0");
        });
    });

    describe("getGitRoot", () => {
        it("should_return_trimmed_git_root", () => {
            spawnSyncSafeMock.mockReturnValue({
                status: 0,
                stdout: "/repo/root\n",
                stderr: "",
                pid: 1,
                output: [],
                signal: null,
                error: undefined,
            });

            expect(getGitRoot()).toBe("/repo/root");
            expect(spawnSyncSafeMock).toHaveBeenCalledWith(
                "git",
                ["rev-parse", "--show-toplevel"],
                expect.objectContaining({ stdio: "pipe" })
            );
        });
    });

    describe("getNxProjectPath", () => {
        it("should_resolve_project_path_under_git_root", () => {
            const gitRoot = tmpRoot;
            spawnSyncSafeMock
                .mockReturnValueOnce({
                    status: 0,
                    stdout: JSON.stringify({ root: "packages/button" }),
                    stderr: "",
                    pid: 1,
                    output: [],
                    signal: null,
                    error: undefined,
                })
                .mockReturnValueOnce({
                    status: 0,
                    stdout: `${gitRoot}\n`,
                    stderr: "",
                    pid: 1,
                    output: [],
                    signal: null,
                    error: undefined,
                });

            const projectPath = getNxProjectPath("button");

            expect(projectPath).toBe(
                path.join(gitRoot, "packages/button")
            );
        });
    });

    describe("readPackageJson", () => {
        it("should_parse_package_json_from_safe_path", () => {
            const pkgPath = path.join(tmpRoot, "package.json");
            spawnSyncSafeMock.mockReturnValue({
                status: 0,
                stdout: `${tmpRoot}\n`,
                stderr: "",
                pid: 1,
                output: [],
                signal: null,
                error: undefined,
            });
            readFileSyncSafeMock.mockReturnValue(
                JSON.stringify({ name: "pkg-a", version: "1.0.0" })
            );

            const pkg = readPackageJson(pkgPath);

            expect(pkg).toEqual({ name: "pkg-a", version: "1.0.0" });
            expect(readFileSyncSafeMock).toHaveBeenCalledWith(
                tmpRoot,
                pkgPath
            );
        });
    });

    describe("writePackageJson", () => {
        it("should_write_stringified_package_json", () => {
            const pkgPath = path.join(tmpRoot, "package.json");
            spawnSyncSafeMock.mockReturnValue({
                status: 0,
                stdout: `${tmpRoot}\n`,
                stderr: "",
                pid: 1,
                output: [],
                signal: null,
                error: undefined,
            });

            writePackageJson(pkgPath, {
                name: "pkg-b",
            });

            expect(writeFileSyncSafeMock).toHaveBeenCalledWith(
                tmpRoot,
                pkgPath,
                JSON.stringify({ name: "pkg-b" }, null, 2)
            );
        });
    });

    describe("runYalcPublish", () => {
        it("should_invoke_yalc_publish", () => {
            spawnSyncSafeMock.mockReturnValue({
                status: 0,
                stdout: "",
                stderr: "",
                pid: 1,
                output: [],
                signal: null,
                error: undefined,
            });

            runYalcPublish(tmpRoot);

            expect(spawnSyncSafeMock).toHaveBeenCalledWith(
                "yalc",
                ["publish"],
                { cwd: tmpRoot, stdio: "inherit" }
            );
        });
    });

    describe("runYalcPublishWithPush", () => {
        it("should_invoke_yalc_publish_with_push", () => {
            spawnSyncSafeMock.mockReturnValue({
                status: 0,
                stdout: "",
                stderr: "",
                pid: 1,
                output: [],
                signal: null,
                error: undefined,
            });

            runYalcPublishWithPush(tmpRoot);

            expect(spawnSyncSafeMock).toHaveBeenCalledWith(
                "yalc",
                ["publish", "--push"],
                { cwd: tmpRoot, stdio: "inherit" }
            );
        });
    });
});

