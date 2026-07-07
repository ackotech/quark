jest.mock("@quark-hq/quark-security", () => {
    const actual = jest.requireActual("@quark-hq/quark-security");
    return {
        ...actual,
        spawnSyncSafe: jest.fn().mockReturnValue({
            status: 0,
            error: undefined,
            stdout: "",
            stderr: "",
        }),
    };
});
jest.mock("fs/promises");

import { spawnSyncSafe } from "@quark-hq/quark-security";
import fs from "fs/promises";
import { NodeReleaseAdapter } from "../../../../src/infrastructure/adapters/node-release-adapter";
import { GraphProvider } from "../../../../src/ports/graph";
import { QuarkConfig } from "../../../../src/ports/config";
import { Logger } from "../../../../src/ports/logger";
import { Graph, PackageMetadata } from "../../../../src/domain/graph";
import { PromptResult } from "../../../../src/ports/prompts";
import { PackageMap } from "../../../../src/ports/map";

const mockSpawnSyncSafe = spawnSyncSafe as jest.MockedFunction<
    typeof spawnSyncSafe
>;
const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
const mockWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;
const mockUnlink = fs.unlink as jest.MockedFunction<typeof fs.unlink>;

describe("NodeReleaseAdapter", () => {
    let adapter: NodeReleaseAdapter;
    let mockGraphProvider: jest.Mocked<GraphProvider>;
    let mockLogger: jest.Mocked<Logger>;

    const config: QuarkConfig = {
        release: {
            masterBranch: "main",
            autoCommit: false,
            autoBump: true,
            freeze: true,
        },
        publish: {
            node: {
                registryUrl: "https://nexus.example.com/npm/",
                devRegistryUrl: "https://nexus.example.com/npm-dev/",
                scope: "@acko",
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockSpawnSyncSafe.mockReturnValue({
            status: 0,
            error: undefined,
            stdout: "",
            stderr: "",
        } as any);

        mockGraphProvider = {
            build: jest.fn(),
            getInvertedAdjacencyList: jest.fn(),
            getPackageJson: jest.fn(),
        };

        mockLogger = {
            info: jest.fn(),
            success: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        adapter = new NodeReleaseAdapter(mockGraphProvider, config, mockLogger);
    });

    describe("supports", () => {
        it("should_returnTrue_whenPlatformIsNode", () => {
            // given
            const meta: PackageMetadata = {
                rootDir: "/dir",
                platform: "node",
            };

            // when / then
            expect(adapter.supports(meta)).toBe(true);
        });

        it("should_returnFalse_whenPlatformIsNotNode", () => {
            // given
            const meta: PackageMetadata = {
                rootDir: "/dir",
                platform: "maven",
            };

            // when / then
            expect(adapter.supports(meta)).toBe(false);
        });
    });

    describe("getCurrentVersion", () => {
        it("should_returnVersion_fromPackageJson", async () => {
            // given
            mockReadFile.mockResolvedValue(
                JSON.stringify({ version: "3.2.1" }) as any
            );

            // when
            const version = await adapter.getCurrentVersion(
                "/repo/packages/ui-button"
            );

            // then
            expect(version).toBe("3.2.1");
        });

        it("should_returnDefault_whenVersionIsMissing", async () => {
            // given
            mockReadFile.mockResolvedValue(JSON.stringify({}) as any);

            // when
            const version = await adapter.getCurrentVersion(
                "/repo/packages/ui-button"
            );

            // then
            expect(version).toBe("1.0.0");
        });
    });

    describe("writeUserPromptsToFiles", () => {
        it("should_updateMapAndWritePackageJson", async () => {
            // given
            const prompt: PromptResult = {
                bump: "patch",
                frozen: false,
                baseVersion: "1.0.0",
                newVersion: "1.0.1",
                changelog: "Fix bug",
            };
            const mapJsonObject: PackageMap = {};
            mockGraphProvider.getPackageJson.mockResolvedValue(
                "packages/ui-button"
            );
            mockReadFile.mockResolvedValue(
                JSON.stringify({
                    name: "@acko/ui-button",
                    version: "1.0.0",
                }) as any
            );
            mockWriteFile.mockResolvedValue(undefined);

            const graph: Graph = {
                adjacency: { "ui-button": [] },
                metadata: {
                    "ui-button": { rootDir: "/repo/packages/ui-button", platform: "node" },
                },
            };

            // when
            await adapter.writeUserPromptsToFiles(
                "ui-button",
                prompt,
                mapJsonObject,
                graph
            );

            // then
            expect(mapJsonObject["ui-button"]).toEqual({
                bumpType: "patch",
                baseVersion: "1.0.0",
                newVersion: "1.0.1",
                changeLog: "Fix bug",
                frozen: false,
            });
            expect(mockWriteFile).toHaveBeenCalledWith(
                expect.stringContaining("package.json"),
                expect.stringContaining('"1.0.1"'),
                "utf8"
            );
        });

        it("should_syncDependencyVersions_whenFrozen", async () => {
            // given
            const prompt: PromptResult = {
                bump: "patch",
                frozen: true,
                baseVersion: "1.0.0",
                newVersion: "1.0.1",
                changelog: "Frozen bump",
            };
            const mapJsonObject: PackageMap = {
                tokens: {
                    bumpType: "major",
                    baseVersion: "1.0.0",
                    newVersion: "2.0.0",
                    changeLog: "breaking",
                    frozen: false,
                },
            };
            mockGraphProvider.getPackageJson.mockResolvedValue(
                "packages/ui-button"
            );
            mockReadFile.mockResolvedValue(
                JSON.stringify({
                    name: "@acko/ui-button",
                    version: "1.0.0",
                    dependencies: {
                        tokens: "^1.0.0",
                    },
                }) as any
            );
            mockWriteFile.mockResolvedValue(undefined);

            const graph: Graph = {
                adjacency: { "ui-button": ["tokens"], tokens: [] },
                metadata: {
                    "ui-button": { rootDir: "/repo/packages/ui-button", platform: "node" },
                    tokens: { rootDir: "/repo/packages/tokens", platform: "node" },
                },
            };

            // when
            await adapter.writeUserPromptsToFiles(
                "ui-button",
                prompt,
                mapJsonObject,
                graph
            );

            // then
            const writtenJson = JSON.parse(
                mockWriteFile.mock.calls[0][1] as string
            );
            expect(writtenJson.dependencies.tokens).toBe("2.0.0");
            expect(mapJsonObject["ui-button"].pinnedDependencies).toEqual({
                tokens: "2.0.0",
            });
        });

        it("should_usePinnedVersionFromFrozenConsumers_whenDepNewVersionDiffers", async () => {
            const prompt: PromptResult = {
                bump: "new",
                frozen: true,
                baseVersion: "1.0.0",
                newVersion: "1.0.0",
                changelog: "New package D",
            };
            const mapJsonObject: PackageMap = {
                A: {
                    bumpType: "patch",
                    baseVersion: "1.0.0",
                    newVersion: "10.0.0",
                    changeLog: "",
                    frozen: true,
                    pinnedDependencies: { B: "2.0.0", C: "1.0.0" },
                },
                B: {
                    bumpType: "patch",
                    baseVersion: "1.0.0",
                    newVersion: "2.0.0",
                    changeLog: "",
                    frozen: true,
                    pinnedDependencies: { A: "4.2.0", C: "1.0.0" },
                },
                C: {
                    bumpType: "major",
                    baseVersion: "1.0.0",
                    newVersion: "3.0.0",
                    changeLog: "major",
                    frozen: false,
                },
            };
            mockGraphProvider.getPackageJson.mockResolvedValue("packages/D");
            mockReadFile.mockResolvedValue(
                JSON.stringify({
                    name: "@scope/D",
                    version: "0.0.0",
                    dependencies: {
                        A: "workspace:*",
                        C: "workspace:*",
                    },
                }) as any
            );
            mockWriteFile.mockResolvedValue(undefined);

            const graph: Graph = {
                adjacency: {
                    D: ["A", "C"],
                    A: [],
                    B: [],
                    C: [],
                },
                metadata: {
                    D: { rootDir: "/repo/packages/D", platform: "node" },
                    A: { rootDir: "/repo/packages/A", platform: "node" },
                    B: { rootDir: "/repo/packages/B", platform: "node" },
                    C: { rootDir: "/repo/packages/C", platform: "node" },
                },
            };

            await adapter.writeUserPromptsToFiles(
                "D",
                prompt,
                mapJsonObject,
                graph
            );

            const writtenJson = JSON.parse(
                mockWriteFile.mock.calls[0][1] as string
            );
            expect(writtenJson.dependencies.A).toBe("4.2.0");
            expect(writtenJson.dependencies.C).toBe("1.0.0");
            expect(mapJsonObject.D.pinnedDependencies).toEqual({
                A: "4.2.0",
                C: "1.0.0",
            });
        });

        it("should_includeTransitiveWorkspaceDepsInPinned_whenFrozen", async () => {
            const prompt: PromptResult = {
                bump: "new",
                frozen: true,
                baseVersion: "1.0.0",
                newVersion: "1.0.0",
                changelog: "New app",
            };
            const mapJsonObject: PackageMap = {
                mid: {
                    bumpType: "patch",
                    baseVersion: "1.0.0",
                    newVersion: "2.0.0",
                    changeLog: "",
                    frozen: false,
                },
                leaf: {
                    bumpType: "patch",
                    baseVersion: "1.0.0",
                    newVersion: "9.0.0",
                    changeLog: "",
                    frozen: true,
                },
            };
            mockGraphProvider.getPackageJson.mockResolvedValue("packages/new-app");
            mockReadFile.mockResolvedValue(
                JSON.stringify({
                    name: "@scope/new-app",
                    version: "0.0.0",
                    dependencies: {
                        mid: "workspace:*",
                    },
                }) as any
            );
            mockWriteFile.mockResolvedValue(undefined);

            const graph: Graph = {
                adjacency: {
                    "new-app": ["mid"],
                    mid: ["leaf"],
                    leaf: [],
                },
                metadata: {
                    "new-app": { rootDir: "/repo/packages/new-app", platform: "node" },
                    mid: { rootDir: "/repo/packages/mid", platform: "node" },
                    leaf: { rootDir: "/repo/packages/leaf", platform: "node" },
                },
            };

            await adapter.writeUserPromptsToFiles(
                "new-app",
                prompt,
                mapJsonObject,
                graph
            );

            expect(mapJsonObject["new-app"].pinnedDependencies).toEqual({
                leaf: "9.0.0",
                mid: "2.0.0",
            });
            const writtenJson = JSON.parse(
                mockWriteFile.mock.calls[0][1] as string
            );
            expect(writtenJson.dependencies.mid).toBe("2.0.0");
            expect(writtenJson.dependencies.leaf).toBeUndefined();
        });
    });

    describe("restoreWorkspaceVersions", () => {
        it("should_restoreWorkspaceDepsToWorkspaceStar", async () => {
            // given
            mockGraphProvider.getPackageJson.mockResolvedValue(
                "packages/dashboard"
            );
            mockReadFile.mockResolvedValue(
                JSON.stringify({
                    name: "@acko/dashboard",
                    version: "2.0.0",
                    dependencies: {
                        button: "2.0.0",
                        "external-lib": "^1.0.0",
                    },
                    devDependencies: {
                        theme: "3.0.0",
                    },
                }) as any
            );
            mockWriteFile.mockResolvedValue(undefined);
            const workspaceNames = new Set(["button", "theme"]);

            // when
            await adapter.restoreWorkspaceVersions("dashboard", workspaceNames);

            // then
            const writtenJson = JSON.parse(
                mockWriteFile.mock.calls[0][1] as string
            );
            expect(writtenJson.dependencies.button).toBe("workspace:*");
            expect(writtenJson.dependencies["external-lib"]).toBe("^1.0.0");
            expect(writtenJson.devDependencies.theme).toBe("workspace:*");
        });

        it("should_leaveNonWorkspaceDepsUnchanged", async () => {
            // given
            mockGraphProvider.getPackageJson.mockResolvedValue(
                "packages/standalone"
            );
            mockReadFile.mockResolvedValue(
                JSON.stringify({
                    name: "@acko/standalone",
                    dependencies: {
                        "lodash": "^4.0.0",
                        "react": "^18.0.0",
                    },
                }) as any
            );
            mockWriteFile.mockResolvedValue(undefined);
            const workspaceNames = new Set<string>();

            // when
            await adapter.restoreWorkspaceVersions("standalone", workspaceNames);

            // then
            const writtenJson = JSON.parse(
                mockWriteFile.mock.calls[0][1] as string
            );
            expect(writtenJson.dependencies.lodash).toBe("^4.0.0");
            expect(writtenJson.dependencies.react).toBe("^18.0.0");
        });
    });

    describe("publish (dev)", () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv, NEXUS_DEV_AUTH: "base64token" };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it("should_publishAlphaVersion_andRestoreFiles", async () => {
            // given
            const ctx = {
                packageName: "ui-button",
                packageDir: "/repo/packages/ui-button",
                repoRoot: "/repo",
            };
            mockReadFile
                .mockResolvedValueOnce(
                    JSON.stringify({ name: "@acko/ui-button", version: "1.0.0" }) as any
                )
                .mockResolvedValueOnce("original-npmrc" as any);
            mockWriteFile.mockResolvedValue(undefined);

            // when
            await adapter.publish(ctx, "1.0.0-alpha.123");

            // then
            expect(mockSpawnSyncSafe).toHaveBeenCalledWith(
                "pnpm",
                ["run", "build"],
                expect.objectContaining({
                    cwd: "/repo/packages/ui-button",
                })
            );
            expect(mockSpawnSyncSafe).toHaveBeenCalledWith(
                "pnpm",
                ["publish", "--no-git-check", "--access", "public"],
                expect.objectContaining({
                    cwd: "/repo/packages/ui-button",
                })
            );
            // Verify files are restored (last two writeFile calls)
            const writeCalls = mockWriteFile.mock.calls;
            const lastWriteContent = writeCalls[writeCalls.length - 1][1];
            expect(lastWriteContent).toBe(
                JSON.stringify({ name: "@acko/ui-button", version: "1.0.0" })
            );
        });

        it("should_throwError_whenDevRegistryUrlNotConfigured", async () => {
            // given
            const emptyConfig: QuarkConfig = {
                release: config.release,
                publish: {
                    node: { registryUrl: "", scope: "", },
                },
            };
            const emptyAdapter = new NodeReleaseAdapter(
                mockGraphProvider,
                emptyConfig,
                mockLogger
            );
            const ctx = {
                packageName: "pkg",
                packageDir: "/repo/pkg",
                repoRoot: "/repo",
            };
            mockReadFile.mockResolvedValue(
                JSON.stringify({ version: "1.0.0" }) as any
            );

            // when / then
            await expect(
                emptyAdapter.publish(ctx, "1.0.0-alpha.1")
            ).rejects.toThrow("Dev registry URL not configured");
        });

        it("should_throwError_whenScopeNotConfigured", async () => {
            // given
            const noScopeConfig: QuarkConfig = {
                release: config.release,
                publish: {
                    node: {
                        registryUrl: "https://nexus.example.com/npm/",
                        scope: "",
                    },
                },
            };
            const noScopeAdapter = new NodeReleaseAdapter(
                mockGraphProvider,
                noScopeConfig,
                mockLogger
            );
            const ctx = {
                packageName: "pkg",
                packageDir: "/repo/pkg",
                repoRoot: "/repo",
            };
            mockReadFile.mockResolvedValue(
                JSON.stringify({ version: "1.0.0" }) as any
            );

            // when / then
            await expect(
                noScopeAdapter.publish(ctx, "1.0.0-alpha.1")
            ).rejects.toThrow("Registry scope not configured");
        });

        it("should_throwError_whenDevAuthTokenIsMissing", async () => {
            // given
            delete process.env.NEXUS_DEV_AUTH;
            delete process.env.DEV_AUTH_TOKEN;
            const ctx = {
                packageName: "pkg",
                packageDir: "/repo/pkg",
                repoRoot: "/repo",
            };
            mockReadFile.mockResolvedValue(
                JSON.stringify({ version: "1.0.0" }) as any
            );

            // when / then
            await expect(
                adapter.publish(ctx, "1.0.0-alpha.1")
            ).rejects.toThrow("DEV_AUTH_TOKEN or NEXUS_DEV_AUTH");
        });

        it("should_restoreFiles_evenWhenBuildFails", async () => {
            // given
            const ctx = {
                packageName: "pkg",
                packageDir: "/repo/pkg",
                repoRoot: "/repo",
            };
            const originalPkgJson = JSON.stringify({ version: "1.0.0" });
            mockReadFile
                .mockResolvedValueOnce(originalPkgJson as any)
                .mockResolvedValueOnce("original-npmrc" as any);
            mockWriteFile.mockResolvedValue(undefined);
            mockSpawnSyncSafe.mockReturnValueOnce({
                status: 1,
                error: undefined,
                stdout: "",
                stderr: "",
            } as any);

            // when / then
            await expect(
                adapter.publish(ctx, "1.0.0-alpha.1")
            ).rejects.toThrow(/pnpm run build failed/);

            // Verify restoration happened in the finally block
            const restoreCalls = mockWriteFile.mock.calls.filter(
                (call) =>
                    (call[1] as string) === "original-npmrc" ||
                    (call[1] as string) === originalPkgJson
            );
            expect(restoreCalls.length).toBeGreaterThanOrEqual(2);
        });
    });
});
