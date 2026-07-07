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

import path from "path";
import { spawnSyncSafe } from "@quark-hq/quark-security";
import fs from "fs/promises";
import { NodeProdPublishAdapter } from "../../../../src/infrastructure/adapters/node-prod-publish-adapter";
import { QuarkConfig } from "../../../../src/ports/config";
import { Logger } from "../../../../src/ports/logger";
import { PackageMetadata } from "../../../../src/domain/graph";

const mockSpawnSyncSafe = spawnSyncSafe as jest.MockedFunction<
    typeof spawnSyncSafe
>;
const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;

describe("NodeProdPublishAdapter", () => {
    let adapter: NodeProdPublishAdapter;
    let mockLogger: jest.Mocked<Logger>;

    const pkgDir = () => path.join(process.cwd(), "packages", "ui-button");

    const baseConfig: QuarkConfig = {
        release: {
            masterBranch: "main",
            autoCommit: false,
            autoBump: true,
            freeze: true,
        },
        publish: {
            node: {
                registryUrl: "https://nexus.example.com/npm-releases/",
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

        mockLogger = {
            info: jest.fn(),
            success: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        adapter = new NodeProdPublishAdapter(baseConfig, mockLogger);
    });

    describe("supports", () => {
        it("should_returnTrue_whenPlatformIsNode", () => {
            // given
            const meta: PackageMetadata = {
                rootDir: "/some/dir",
                platform: "node",
            };

            // when / then
            expect(adapter.supports(meta)).toBe(true);
        });

        it("should_returnFalse_whenPlatformIsMaven", () => {
            // given
            const meta: PackageMetadata = {
                rootDir: "/some/dir",
                platform: "maven",
            };

            // when / then
            expect(adapter.supports(meta)).toBe(false);
        });

        it("should_returnFalse_whenPlatformIsUnknown", () => {
            // given
            const meta: PackageMetadata = {
                rootDir: "/some/dir",
                platform: "unknown",
            };

            // when / then
            expect(adapter.supports(meta)).toBe(false);
        });
    });

    describe("readPackageIdentity", () => {
        it("should_returnNameAndVersion_fromPackageJson", async () => {
            // given
            mockReadFile.mockResolvedValue(
                JSON.stringify({
                    name: "@acko/ui-button",
                    version: "2.3.1",
                }) as any
            );

            // when
            const identity = await adapter.readPackageIdentity(pkgDir());

            // then
            expect(identity).toEqual({
                name: "@acko/ui-button",
                version: "2.3.1",
            });
            expect(mockReadFile).toHaveBeenCalledWith(
                expect.stringContaining("package.json"),
                "utf8"
            );
        });

        it("should_throwError_whenPackageJsonIsMalformed", async () => {
            // given
            mockReadFile.mockResolvedValue("not-json" as any);

            // when / then
            await expect(
                adapter.readPackageIdentity(
                    path.join(process.cwd(), "packages", "broken")
                )
            ).rejects.toThrow();
        });
    });

    describe("versionExistsInRegistry", () => {
        it("should_returnTrue_whenVersionFoundInRegistry", async () => {
            // given – npm view succeeds (version exists)
            mockSpawnSyncSafe.mockReturnValue({
                status: 0,
                error: undefined,
                stdout: "2.3.1",
                stderr: "",
            } as any);

            // when
            const exists = await adapter.versionExistsInRegistry(
                "@acko/ui-button",
                "2.3.1"
            );

            // then
            expect(exists).toBe(true);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("already exists")
            );
        });

        it("should_returnFalse_whenVersionNotFoundInAnyRegistry", async () => {
            // given – npm view non-zero (version not found)
            mockSpawnSyncSafe.mockReturnValue({
                status: 1,
                error: undefined,
                stdout: "",
                stderr: "404",
            } as any);

            // when
            const exists = await adapter.versionExistsInRegistry(
                "@acko/ui-button",
                "9.9.9"
            );

            // then
            expect(exists).toBe(false);
        });

        it("should_checkBothDevAndProdRegistries_whenConfigured", async () => {
            // given – separate dev and prod registries
            const splitConfig: QuarkConfig = {
                ...baseConfig,
                publish: {
                    node: {
                        registryUrl: "https://nexus.example.com/base/",
                        devRegistryUrl: "https://nexus.example.com/npm-dev/",
                        prodRegistryUrl:
                            "https://nexus.example.com/npm-prod/",
                        scope: "@acko",
                    },
                },
            };
            const splitAdapter = new NodeProdPublishAdapter(
                splitConfig,
                mockLogger
            );
            mockSpawnSyncSafe.mockReturnValue({
                status: 1,
                error: undefined,
                stdout: "",
                stderr: "",
            } as any);

            // when
            await splitAdapter.versionExistsInRegistry(
                "@acko/ui-button",
                "1.0.0"
            );

            // then – two unique URLs checked (dev + prod)
            expect(mockSpawnSyncSafe).toHaveBeenCalledTimes(2);
            const calls = mockSpawnSyncSafe.mock.calls.map((c) => c[1]);
            const joined = JSON.stringify(calls);
            expect(joined.includes("npm-dev")).toBe(true);
            expect(joined.includes("npm-prod")).toBe(true);
        });

        it("should_deduplicateRegistryUrls_whenDevAndProdAreSame", async () => {
            // given – single registry for both
            mockSpawnSyncSafe.mockReturnValue({
                status: 1,
                error: undefined,
                stdout: "",
                stderr: "",
            } as any);

            // when
            await adapter.versionExistsInRegistry(
                "@acko/ui-button",
                "1.0.0"
            );

            // then – only 1 call because registryUrl is used for both
            expect(mockSpawnSyncSafe).toHaveBeenCalledTimes(1);
        });

        it("should_throwError_whenNoRegistryUrlsConfigured", async () => {
            // given
            const emptyConfig: QuarkConfig = {
                release: baseConfig.release,
                publish: { node: { registryUrl: "", scope: "@acko" } },
            };
            const emptyAdapter = new NodeProdPublishAdapter(
                emptyConfig,
                mockLogger
            );

            // when / then
            await expect(
                emptyAdapter.versionExistsInRegistry("@acko/pkg", "1.0.0")
            ).rejects.toThrow("No registry URLs configured");
        });
    });

    describe("publish", () => {
        it("should_runPnpmPublish_withProdRegistryUrl", async () => {
            // given
            mockSpawnSyncSafe.mockReturnValue({
                status: 0,
                error: undefined,
                stdout: "",
                stderr: "",
            } as any);

            // when
            await adapter.publish(pkgDir());

            // then
            expect(mockSpawnSyncSafe).toHaveBeenCalledWith(
                "pnpm",
                [
                    "publish",
                    "--registry",
                    "https://nexus.example.com/npm-releases/",
                    "--no-git-checks",
                ],
                expect.objectContaining({ cwd: pkgDir() })
            );
            expect(mockSpawnSyncSafe).toHaveBeenCalledTimes(1);
        });

        it("should_publishToDevThenProd_whenBothRegistriesConfigured", async () => {
            // given
            const splitConfig: QuarkConfig = {
                ...baseConfig,
                publish: {
                    node: {
                        registryUrl: "https://nexus.example.com/base/",
                        devRegistryUrl: "https://nexus.example.com/npm-dev/",
                        prodRegistryUrl:
                            "https://nexus.example.com/npm-prod/",
                        scope: "@acko",
                    },
                },
            };
            const splitAdapter = new NodeProdPublishAdapter(
                splitConfig,
                mockLogger
            );
            mockSpawnSyncSafe.mockReturnValue({
                status: 0,
                error: undefined,
                stdout: "",
                stderr: "",
            } as any);

            // when
            await splitAdapter.publish(pkgDir());

            // then
            expect(mockSpawnSyncSafe).toHaveBeenCalledTimes(2);
            expect(mockSpawnSyncSafe).toHaveBeenNthCalledWith(
                1,
                "pnpm",
                expect.arrayContaining([
                    "--registry",
                    "https://nexus.example.com/npm-dev/",
                ]),
                expect.any(Object)
            );
            expect(mockSpawnSyncSafe).toHaveBeenNthCalledWith(
                2,
                "pnpm",
                expect.arrayContaining([
                    "--registry",
                    "https://nexus.example.com/npm-prod/",
                ]),
                expect.any(Object)
            );
        });

        it("should_useProdRegistryUrl_whenOverrideConfigured", async () => {
            // given
            const overrideConfig: QuarkConfig = {
                ...baseConfig,
                publish: {
                    node: {
                        registryUrl: "https://nexus.example.com/base/",
                        prodRegistryUrl:
                            "https://nexus.example.com/npm-prod/",
                        scope: "@acko",
                    },
                },
            };
            const overrideAdapter = new NodeProdPublishAdapter(
                overrideConfig,
                mockLogger
            );
            mockSpawnSyncSafe.mockReturnValue({
                status: 0,
                error: undefined,
                stdout: "",
                stderr: "",
            } as any);

            // when
            await overrideAdapter.publish(pkgDir());

            // then
            expect(mockSpawnSyncSafe).toHaveBeenCalledWith(
                "pnpm",
                expect.arrayContaining([
                    "publish",
                    "--registry",
                    "https://nexus.example.com/npm-prod/",
                ]),
                expect.any(Object)
            );
        });

        it("should_throwError_whenNoProdRegistryUrlConfigured", async () => {
            // given
            const emptyConfig: QuarkConfig = {
                release: baseConfig.release,
                publish: { node: { registryUrl: "", scope: "@acko" } },
            };
            const emptyAdapter = new NodeProdPublishAdapter(
                emptyConfig,
                mockLogger
            );

            // when / then
            await expect(
                emptyAdapter.publish(
                    path.join(process.cwd(), "packages", "pkg")
                )
            ).rejects.toThrow("No registry URLs configured");
        });

        describe("registry URLs from process.env", () => {
            const saved: Record<string, string | undefined> = {};

            beforeEach(() => {
                for (const k of [
                    "DEV_REGISTRY_URL",
                    "PROD_REGISTRY_URL",
                ] as const) {
                    saved[k] = process.env[k];
                    delete process.env[k];
                }
            });

            afterEach(() => {
                for (const k of [
                    "DEV_REGISTRY_URL",
                    "PROD_REGISTRY_URL",
                ] as const) {
                    if (saved[k] === undefined) {
                        delete process.env[k];
                    } else {
                        process.env[k] = saved[k];
                    }
                }
            });

            it("should_preferDevAndProdFromEnv_overQuarkConfig", async () => {
                process.env.DEV_REGISTRY_URL =
                    "https://env.example.com/npm-alpha/";
                process.env.PROD_REGISTRY_URL =
                    "https://env.example.com/npm-stable/";
                const wrongUrls: QuarkConfig = {
                    ...baseConfig,
                    publish: {
                        node: {
                            registryUrl: "https://config-should-not-win.example/",
                            devRegistryUrl:
                                "https://config-dev-should-not-win.example/",
                            prodRegistryUrl:
                                "https://config-prod-should-not-win.example/",
                            scope: "@acko",
                        },
                    },
                };
                const envAdapter = new NodeProdPublishAdapter(
                    wrongUrls,
                    mockLogger
                );
                mockSpawnSyncSafe.mockReturnValue({
                    status: 0,
                    error: undefined,
                    stdout: "",
                    stderr: "",
                } as any);

                await envAdapter.publish(pkgDir());

                expect(mockSpawnSyncSafe).toHaveBeenNthCalledWith(
                    1,
                    "pnpm",
                    expect.arrayContaining([
                        "--registry",
                        "https://env.example.com/npm-alpha/",
                    ]),
                    expect.any(Object)
                );
                expect(mockSpawnSyncSafe).toHaveBeenNthCalledWith(
                    2,
                    "pnpm",
                    expect.arrayContaining([
                        "--registry",
                        "https://env.example.com/npm-stable/",
                    ]),
                    expect.any(Object)
                );
            });
        });
    });
});
