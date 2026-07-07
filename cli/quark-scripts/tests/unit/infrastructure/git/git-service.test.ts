/* eslint-disable @typescript-eslint/no-var-requires -- jest.mock factory uses require for util */
/**
 * execFile must keep util.promisify.custom so promisify(execFile) resolves { stdout, stderr }.
 * A plain jest.fn() replacement drops that symbol and breaks NodeGitService.
 */
var mockExecFile: jest.Mock;

jest.mock("child_process", () => {
    const util = require("util");
    const actual = jest.requireActual("child_process");
    mockExecFile = jest.fn();

    function execFile(...args: unknown[]) {
        const cb = args[args.length - 1];
        if (typeof cb === "function") {
            return mockExecFile(...(args as Parameters<typeof mockExecFile>));
        }
    }

    (
        execFile as typeof import("child_process").execFile & {
            [key: symbol]: unknown;
        }
    )[util.promisify.custom] = (
        command: string,
        args: string[],
        options: object
    ) =>
        new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
            mockExecFile(
                command,
                args,
                options,
                (
                    err: Error | null,
                    stdout?: string | Buffer,
                    stderr?: string | Buffer
                ) => {
                    if (err) reject(err);
                    else {
                        resolve({
                            stdout:
                                typeof stdout === "string"
                                    ? stdout
                                    : stdout?.toString() ?? "",
                            stderr:
                                typeof stderr === "string"
                                    ? stderr
                                    : stderr?.toString() ?? "",
                        });
                    }
                }
            );
        });

    return { ...actual, execFile };
});

import { NodeGitService } from "../../../../src/infrastructure/git/gitService";

function mockExecFileSuccess(stdout: string) {
    mockExecFile.mockImplementation(
        (
            _file: string,
            _args: string[],
            _opts: object,
            cb: (err: Error | null, stdout: string, stderr: string) => void
        ) => {
            process.nextTick(() => cb(null, stdout, ""));
        }
    );
}

function mockExecFailure(message: string) {
    mockExecFile.mockImplementation(
        (
            _file: string,
            _args: string[],
            _opts: object,
            cb: (err: Error | null, stdout: string, stderr: string) => void
        ) => {
            process.nextTick(() => cb(new Error(message), "", ""));
        }
    );
}

describe("NodeGitService", () => {
    let service: NodeGitService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new NodeGitService();
    });

    describe("getRepositoryRoot", () => {
        it("should_returnTrimmedPath", async () => {
            mockExecFileSuccess("/home/user/repo\n");

            const root = await service.getRepositoryRoot();

            expect(root).toBe("/home/user/repo");
            expect(mockExecFile).toHaveBeenCalledWith(
                "git",
                ["rev-parse", "--show-toplevel"],
                expect.any(Object),
                expect.any(Function)
            );
        });
    });

    describe("getCurrentBranch", () => {
        it("should_returnBranchName_whenRepoHasCommits", async () => {
            mockExecFile.mockImplementation(
                (
                    _file: string,
                    args: string[],
                    _opts: object,
                    cb: (err: Error | null, stdout: string, stderr: string) => void
                ) => {
                    process.nextTick(() => {
                        if (
                            args[0] === "rev-parse" &&
                            args[1] === "HEAD" &&
                            args.length === 2
                        ) {
                            cb(null, "abc123\n", "");
                        } else if (
                            args[0] === "rev-parse" &&
                            args[1] === "--abbrev-ref"
                        ) {
                            cb(null, "feature-branch\n", "");
                        } else {
                            cb(null, "", "");
                        }
                    });
                }
            );

            const branch = await service.getCurrentBranch();

            expect(branch).toBe("feature-branch");
        });
    });

    describe("fetch", () => {
        it("should_executeFetchCommand", async () => {
            mockExecFileSuccess("");

            await service.fetch("main");

            expect(mockExecFile).toHaveBeenCalledWith(
                "git",
                ["fetch", "origin", "main"],
                expect.any(Object),
                expect.any(Function)
            );
        });

        it("should_silentlyIgnore_whenFetchFails", async () => {
            mockExecFailure("fatal: remote not found");

            await expect(service.fetch("main")).resolves.toBeUndefined();
        });
    });

    describe("commitsBehind", () => {
        it("should_returnCount_whenBranchIsBehind", async () => {
            mockExecFile.mockImplementation(
                (
                    _file: string,
                    args: string[],
                    _opts: object,
                    cb: (err: Error | null, stdout: string, stderr: string) => void
                ) => {
                    process.nextTick(() => {
                        if (
                            args[0] === "rev-parse" &&
                            args[1] === "HEAD" &&
                            args.length === 2
                        ) {
                            cb(null, "abc123\n", "");
                        } else if (args[0] === "rev-list") {
                            cb(null, "5\n", "");
                        } else {
                            cb(null, "", "");
                        }
                    });
                }
            );

            const count = await service.commitsBehind("main");

            expect(count).toBe(5);
        });

        it("should_returnZero_whenNoCommitsExist", async () => {
            mockExecFailure("fatal: bad default revision 'HEAD'");

            const count = await service.commitsBehind("main");

            expect(count).toBe(0);
        });
    });

    describe("readFile", () => {
        it("should_returnFileContent_fromRemoteBranch", async () => {
            mockExecFileSuccess('{"version": "1.0.0"}\n');

            const content = await service.readFile(".release/map.json", "main");

            expect(content).toBe('{"version": "1.0.0"}');
            expect(mockExecFile).toHaveBeenCalledWith(
                "git",
                ["show", "origin/main:.release/map.json"],
                expect.any(Object),
                expect.any(Function)
            );
        });
    });

    describe("readFileFromRef", () => {
        it("should_returnFileContent_fromGitRef", async () => {
            mockExecFileSuccess('{"pkg-a": {"newVersion": "1.0.0"}}\n');

            const content = await service.readFileFromRef(
                ".release/map.json",
                "v1.0.0"
            );

            expect(content).toBe('{"pkg-a": {"newVersion": "1.0.0"}}');
            expect(mockExecFile).toHaveBeenCalledWith(
                "git",
                ["show", "v1.0.0:.release/map.json"],
                expect.any(Object),
                expect.any(Function)
            );
        });
    });

    describe("getTags", () => {
        it("should_returnLatestTwoPreviousTags_whenNoTargetSpecified", async () => {
            mockExecFileSuccess("v2.0.0\nv1.1.0\nv1.0.0\n");

            const [previous, latest] = await service.getTags();

            expect(previous).toBe("v1.1.0");
            expect(latest).toBe("v2.0.0");
        });

        it("should_returnTargetAndPreviousTag_whenTargetSpecified", async () => {
            mockExecFileSuccess("v2.0.0\nv1.1.0\nv1.0.0\n");

            const [previous, target] = await service.getTags("v1.1.0");

            expect(previous).toBe("v1.0.0");
            expect(target).toBe("v1.1.0");
        });

        it("should_returnNullPrevious_whenSingleTagAndNoTarget", async () => {
            mockExecFileSuccess("v1.0.0\n");

            const [previous, latest] = await service.getTags();

            expect(previous).toBeNull();
            expect(latest).toBe("v1.0.0");
        });

        it("should_returnNullPrevious_whenSingleTagAndTargetMatches", async () => {
            mockExecFileSuccess("v1.0.0\n");

            const [previous, target] = await service.getTags("v1.0.0");

            expect(previous).toBeNull();
            expect(target).toBe("v1.0.0");
        });

        it("should_throwError_whenNoGitTags", async () => {
            mockExecFileSuccess("");

            await expect(service.getTags()).rejects.toThrow(
                "No git tags found"
            );
        });

        it("should_throwError_whenTargetTagNotFound", async () => {
            mockExecFileSuccess("v2.0.0\nv1.0.0\n");

            await expect(service.getTags("v3.0.0")).rejects.toThrow(
                'Tag "v3.0.0" not found'
            );
        });

        it("should_returnNullPrevious_whenTargetIsOldestTag", async () => {
            mockExecFileSuccess("v2.0.0\nv1.0.0\n");

            const [previous, target] = await service.getTags("v1.0.0");

            expect(previous).toBeNull();
            expect(target).toBe("v1.0.0");
        });
    });

    describe("getChangedFiles", () => {
        it("should_returnCombinedTrackedAndUntrackedFiles", async () => {
            mockExecFile.mockImplementation(
                (
                    _file: string,
                    args: string[],
                    _opts: object,
                    cb: (err: Error | null, stdout: string, stderr: string) => void
                ) => {
                    process.nextTick(() => {
                        if (
                            args[0] === "rev-parse" &&
                            args[1] === "HEAD" &&
                            args.length === 2
                        ) {
                            cb(null, "abc123\n", "");
                        } else if (args[0] === "diff") {
                            cb(null, "packages/a/index.ts\n", "");
                        } else if (args[0] === "ls-files") {
                            cb(null, "packages/b/new-file.ts\n", "");
                        } else {
                            cb(null, "", "");
                        }
                    });
                }
            );

            const files = await service.getChangedFiles("main");

            expect(files).toContain("packages/a/index.ts");
            expect(files).toContain("packages/b/new-file.ts");
        });

        it("should_deduplicateFiles", async () => {
            mockExecFile.mockImplementation(
                (
                    _file: string,
                    args: string[],
                    _opts: object,
                    cb: (err: Error | null, stdout: string, stderr: string) => void
                ) => {
                    process.nextTick(() => {
                        if (
                            args[0] === "rev-parse" &&
                            args[1] === "HEAD" &&
                            args.length === 2
                        ) {
                            cb(null, "abc123\n", "");
                        } else if (args[0] === "diff") {
                            cb(null, "packages/a/index.ts\n", "");
                        } else if (args[0] === "ls-files") {
                            cb(null, "packages/a/index.ts\n", "");
                        } else {
                            cb(null, "", "");
                        }
                    });
                }
            );

            const files = await service.getChangedFiles("main");

            expect(files).toHaveLength(1);
        });
    });
});
