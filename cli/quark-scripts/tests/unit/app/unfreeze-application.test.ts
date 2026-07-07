import { UnfreezeApplication } from "../../../src/app/unfreeze-application";
import { UnfreezeBlockedByFrozenDependenciesError } from "../../../src/errors/unfreeze-blocked-error";
import { GraphProvider } from "../../../src/ports/graph";
import { ReleaseMapStore } from "../../../src/ports/release-map-store";
import { Logger } from "../../../src/ports/logger";
import { NodeReleaseAdapter } from "../../../src/infrastructure/adapters/node-release-adapter";
import { Graph } from "../../../src/domain/graph";
import { PackageMap } from "../../../src/ports/map";

describe("UnfreezeApplication", () => {
    let app: UnfreezeApplication;
    let mockGraphProvider: jest.Mocked<GraphProvider>;
    let mockReleaseMapStore: jest.Mocked<ReleaseMapStore>;
    let mockNodeReleaseAdapter: jest.Mocked<NodeReleaseAdapter>;
    let mockLogger: jest.Mocked<Logger>;

    const sampleGraph: Graph = {
        adjacency: {
            button: [],
            dashboard: ["button"],
        },
        metadata: {
            button: { rootDir: "/repo/packages/button", platform: "node" },
            dashboard: {
                rootDir: "/repo/packages/dashboard",
                platform: "node",
            },
        },
    };

    beforeEach(() => {
        mockGraphProvider = {
            build: jest.fn(),
            getInvertedAdjacencyList: jest.fn(),
            getPackageJson: jest.fn(),
        };

        mockReleaseMapStore = {
            read: jest.fn(),
            readLocal: jest.fn(),
            readMergedWithLocal: jest.fn(),
            write: jest.fn(),
        };

        mockNodeReleaseAdapter = {
            restoreWorkspaceVersions: jest.fn(),
        } as unknown as jest.Mocked<NodeReleaseAdapter>;

        mockLogger = {
            info: jest.fn(),
            success: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        app = new UnfreezeApplication(
            mockGraphProvider,
            mockReleaseMapStore,
            mockNodeReleaseAdapter,
            mockLogger,
            "main"
        );
    });

    /** Dashboard is frozen; button is not frozen so dashboard can be unfrozen first. */
    const mainMapWithDashboardFrozen: PackageMap = {
        button: {
            bumpType: "patch",
            baseVersion: "1.0.0",
            newVersion: "1.0.0",
            changeLog: "Already unfrozen",
            frozen: false,
        },
        dashboard: {
            bumpType: "patch",
            baseVersion: "2.0.0",
            newVersion: "2.0.0",
            changeLog: "Frozen due to button",
            frozen: true,
        },
    };

    describe("execute", () => {
        it("should_unfreezePackage_whenPackageExistsAndIsFrozenOnMainAndLocal", async () => {
            // given — main and local both have dashboard frozen
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockReleaseMapStore.read.mockResolvedValue(mainMapWithDashboardFrozen);
            mockReleaseMapStore.readLocal.mockResolvedValue({
                ...mainMapWithDashboardFrozen,
            });

            // when
            await app.execute("dashboard");

            // then
            expect(mockReleaseMapStore.read).toHaveBeenCalledWith("main");
            expect(mockReleaseMapStore.readLocal).toHaveBeenCalled();
            expect(mockNodeReleaseAdapter.restoreWorkspaceVersions).toHaveBeenCalledWith(
                "dashboard",
                new Set(["button", "dashboard"])
            );
            expect(mockReleaseMapStore.write).toHaveBeenCalledWith(
                expect.objectContaining({
                    dashboard: expect.objectContaining({
                        frozen: false,
                        baseVersion: "2.0.0",
                        newVersion: "2.0.0",
                    }),
                })
            );
            expect(mockLogger.success).toHaveBeenCalledWith(
                'Unfroze package "dashboard". Dependency versions restored to workspace:*.'
            );
        });

        it("should_useMainAsBase_whenLocalMapIsEmpty", async () => {
            // given — main has dashboard frozen, local is empty
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockReleaseMapStore.read.mockResolvedValue(mainMapWithDashboardFrozen);
            mockReleaseMapStore.readLocal.mockResolvedValue({});

            // when
            await app.execute("dashboard");

            // then — baseMap comes from main, write includes all packages
            expect(mockReleaseMapStore.write).toHaveBeenCalledWith(
                expect.objectContaining({
                    button: expect.any(Object),
                    dashboard: expect.objectContaining({ frozen: false }),
                })
            );
        });

        it("should_throw_whenPackageNotFound", async () => {
            // given
            mockGraphProvider.build.mockResolvedValue(sampleGraph);

            // when / then
            await expect(app.execute("unknown-pkg")).rejects.toThrow(
                'Package "unknown-pkg" not found in workspace.'
            );
            expect(mockReleaseMapStore.read).not.toHaveBeenCalled();
            expect(mockNodeReleaseAdapter.restoreWorkspaceVersions).not.toHaveBeenCalled();
        });

        it("should_syncToMain_whenMainNotFrozenButLocalFrozen", async () => {
            // given — main unfrozen (someone else unfroze), local still frozen (stale)
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockReleaseMapStore.read.mockResolvedValue({
                dashboard: {
                    bumpType: "patch" as const,
                    baseVersion: "2.0.0",
                    newVersion: "2.0.1",
                    changeLog: "Unfroze on main",
                    frozen: false,
                },
            } as PackageMap);
            mockReleaseMapStore.readLocal.mockResolvedValue({
                dashboard: {
                    bumpType: "patch",
                    baseVersion: "2.0.0",
                    newVersion: "2.0.0",
                    changeLog: "Frozen (stale)",
                    frozen: true,
                },
            } as PackageMap);

            // when
            await app.execute("dashboard");

            // then — repairs local: restores workspace:*, sets frozen false
            expect(mockNodeReleaseAdapter.restoreWorkspaceVersions).toHaveBeenCalledWith(
                "dashboard",
                new Set(["button", "dashboard"])
            );
            expect(mockReleaseMapStore.write).toHaveBeenCalledWith(
                expect.objectContaining({
                    dashboard: expect.objectContaining({ frozen: false }),
                })
            );
        });

        it("should_throw_whenPackageNotFrozenOnMainOrLocal", async () => {
            // given — both main and local have dashboard unfrozen
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockReleaseMapStore.read.mockResolvedValue({
                dashboard: {
                    bumpType: "patch" as const,
                    baseVersion: "2.0.0",
                    newVersion: "2.0.1",
                    changeLog: "Update",
                    frozen: false,
                },
            } as PackageMap);
            mockReleaseMapStore.readLocal.mockResolvedValue({
                dashboard: {
                    bumpType: "patch",
                    baseVersion: "2.0.0",
                    newVersion: "2.0.1",
                    changeLog: "Update",
                    frozen: false,
                },
            } as PackageMap);

            // when / then
            await expect(app.execute("dashboard")).rejects.toThrow(
                'Package "dashboard" is not frozen. Nothing to unfreeze.'
            );
            expect(mockNodeReleaseAdapter.restoreWorkspaceVersions).not.toHaveBeenCalled();
        });

        it("should_throw_whenPackageNotInMainOrLocalMap", async () => {
            // given — neither main nor local has dashboard
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockReleaseMapStore.read.mockResolvedValue({});
            mockReleaseMapStore.readLocal.mockResolvedValue({});

            // when / then
            await expect(app.execute("dashboard")).rejects.toThrow(
                'Package "dashboard" not found in release map.'
            );
        });

        it("should_throw_whenGraphIsEmpty", async () => {
            // given
            mockGraphProvider.build.mockResolvedValue({
                adjacency: {},
                metadata: {},
            });

            // when / then
            await expect(app.execute("dashboard")).rejects.toThrow(
                "Dependency graph is empty"
            );
        });

        it("should_throw_whenUnfreezingConsumerWhileDirectDependencyStillFrozen", async () => {
            // given — dashboard depends on button; both frozen → must unfreeze button first
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockReleaseMapStore.read.mockResolvedValue({
                button: {
                    bumpType: "patch" as const,
                    baseVersion: "1.0.0",
                    newVersion: "1.0.0",
                    changeLog: "Frozen lib",
                    frozen: true,
                },
                dashboard: {
                    bumpType: "patch" as const,
                    baseVersion: "2.0.0",
                    newVersion: "2.0.0",
                    changeLog: "Frozen app",
                    frozen: true,
                },
            } as PackageMap);
            mockReleaseMapStore.readLocal.mockResolvedValue({
                button: {
                    bumpType: "patch",
                    baseVersion: "1.0.0",
                    newVersion: "1.0.0",
                    changeLog: "Frozen lib",
                    frozen: true,
                },
                dashboard: {
                    bumpType: "patch",
                    baseVersion: "2.0.0",
                    newVersion: "2.0.0",
                    changeLog: "Frozen app",
                    frozen: true,
                },
            } as PackageMap);

            // when / then
            let caught: unknown;
            try {
                await app.execute("dashboard");
            } catch (e) {
                caught = e;
            }
            expect(caught).toBeInstanceOf(UnfreezeBlockedByFrozenDependenciesError);
            const err = caught as UnfreezeBlockedByFrozenDependenciesError;
            expect(err.requestedPackage).toBe("dashboard");
            expect([...err.blockingPackages]).toEqual(["button"]);
            expect(err.message).toContain("dashboard");
            expect(err.message).toContain("button");
            expect(mockNodeReleaseAdapter.restoreWorkspaceVersions).not.toHaveBeenCalled();
        });

        /** app-a → lib-b → lib-c (A depends on B, B on C); C was major-bumped, A and B frozen. */
        const abcGraph: Graph = {
            adjacency: {
                "app-a": ["lib-b"],
                "lib-b": ["lib-c"],
                "lib-c": [],
            },
            metadata: {
                "app-a": { rootDir: "/repo/packages/app-a", platform: "node" },
                "lib-b": { rootDir: "/repo/packages/lib-b", platform: "node" },
                "lib-c": { rootDir: "/repo/packages/lib-c", platform: "node" },
            },
        };

        it("should_throw_whenUnfreezingAppA_whileLibBStillFrozen", async () => {
            mockGraphProvider.build.mockResolvedValue(abcGraph);
            const map: PackageMap = {
                "app-a": {
                    bumpType: "patch" as const,
                    baseVersion: "1.0.0",
                    newVersion: "1.0.0",
                    changeLog: "",
                    frozen: true,
                },
                "lib-b": {
                    bumpType: "patch" as const,
                    baseVersion: "2.0.0",
                    newVersion: "2.0.0",
                    changeLog: "",
                    frozen: true,
                },
                "lib-c": {
                    bumpType: "major" as const,
                    baseVersion: "1.0.0",
                    newVersion: "2.0.0",
                    changeLog: "Major",
                    frozen: false,
                },
            };
            mockReleaseMapStore.read.mockResolvedValue(map);
            mockReleaseMapStore.readLocal.mockResolvedValue({ ...map });

            await expect(app.execute("app-a")).rejects.toThrow(
                UnfreezeBlockedByFrozenDependenciesError
            );
            expect(mockNodeReleaseAdapter.restoreWorkspaceVersions).not.toHaveBeenCalled();
        });

        it("should_throw_whenUnfreezingAppA_whileOnlyLibCStillFrozen", async () => {
            mockGraphProvider.build.mockResolvedValue(abcGraph);
            const map: PackageMap = {
                "app-a": {
                    bumpType: "patch" as const,
                    baseVersion: "1.0.0",
                    newVersion: "1.0.0",
                    changeLog: "",
                    frozen: true,
                },
                "lib-b": {
                    bumpType: "patch" as const,
                    baseVersion: "2.0.0",
                    newVersion: "2.0.0",
                    changeLog: "",
                    frozen: false,
                },
                "lib-c": {
                    bumpType: "major" as const,
                    baseVersion: "1.0.0",
                    newVersion: "2.0.0",
                    changeLog: "",
                    frozen: true,
                },
            };
            mockReleaseMapStore.read.mockResolvedValue(map);
            mockReleaseMapStore.readLocal.mockResolvedValue({ ...map });

            await expect(app.execute("app-a")).rejects.toThrow(
                UnfreezeBlockedByFrozenDependenciesError
            );
        });

        it("should_unfreezeAppA_whenLibBAndLibCAreNotFrozen", async () => {
            mockGraphProvider.build.mockResolvedValue(abcGraph);
            const map: PackageMap = {
                "app-a": {
                    bumpType: "patch" as const,
                    baseVersion: "1.0.0",
                    newVersion: "1.0.0",
                    changeLog: "",
                    frozen: true,
                },
                "lib-b": {
                    bumpType: "patch" as const,
                    baseVersion: "2.0.0",
                    newVersion: "2.0.0",
                    changeLog: "",
                    frozen: false,
                },
                "lib-c": {
                    bumpType: "major" as const,
                    baseVersion: "1.0.0",
                    newVersion: "2.0.0",
                    changeLog: "",
                    frozen: false,
                },
            };
            mockReleaseMapStore.read.mockResolvedValue(map);
            mockReleaseMapStore.readLocal.mockResolvedValue({ ...map });

            await app.execute("app-a");

            expect(mockNodeReleaseAdapter.restoreWorkspaceVersions).toHaveBeenCalledWith(
                "app-a",
                new Set(["app-a", "lib-b", "lib-c"])
            );
            expect(mockReleaseMapStore.write).toHaveBeenCalledWith(
                expect.objectContaining({
                    "app-a": expect.objectContaining({ frozen: false }),
                })
            );
        });

        it("should_throw_whenUnfreezingLibB_whileLibCStillFrozen", async () => {
            mockGraphProvider.build.mockResolvedValue(abcGraph);
            const map: PackageMap = {
                "app-a": {
                    bumpType: "patch" as const,
                    baseVersion: "1.0.0",
                    newVersion: "1.0.0",
                    changeLog: "",
                    frozen: true,
                },
                "lib-b": {
                    bumpType: "patch" as const,
                    baseVersion: "2.0.0",
                    newVersion: "2.0.0",
                    changeLog: "",
                    frozen: true,
                },
                "lib-c": {
                    bumpType: "major" as const,
                    baseVersion: "1.0.0",
                    newVersion: "2.0.0",
                    changeLog: "",
                    frozen: true,
                },
            };
            mockReleaseMapStore.read.mockResolvedValue(map);
            mockReleaseMapStore.readLocal.mockResolvedValue({ ...map });

            await expect(app.execute("lib-b")).rejects.toThrow(
                UnfreezeBlockedByFrozenDependenciesError
            );
        });

        it("should_throw_whenPlatformIsMaven", async () => {
            // given
            mockGraphProvider.build.mockResolvedValue({
                adjacency: { "maven-pkg": [] },
                metadata: {
                    "maven-pkg": {
                        rootDir: "/repo/packages/maven",
                        platform: "maven",
                    },
                },
            });
            mockReleaseMapStore.read.mockResolvedValue({
                "maven-pkg": {
                    bumpType: "patch",
                    baseVersion: "1.0.0",
                    newVersion: "1.0.0",
                    changeLog: "Frozen",
                    frozen: true,
                },
            });
            mockReleaseMapStore.readLocal.mockResolvedValue({
                "maven-pkg": {
                    bumpType: "patch",
                    baseVersion: "1.0.0",
                    newVersion: "1.0.0",
                    changeLog: "Frozen",
                    frozen: true,
                },
            });

            // when / then
            await expect(app.execute("maven-pkg")).rejects.toThrow(
                "Unfreeze for Maven packages is not implemented yet"
            );
            expect(mockNodeReleaseAdapter.restoreWorkspaceVersions).not.toHaveBeenCalled();
        });
    });
});
