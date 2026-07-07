import { ProdPublishApplication } from "../../../src/app/prod-publish-application";
import { Logger } from "../../../src/ports/logger";
import { GitService } from "../../../src/ports/git";
import { GraphProvider } from "../../../src/ports/graph";
import { PlatformProdPublishAdapter } from "../../../src/ports/platform-prod-publish-adapter";
import { Graph } from "../../../src/domain/graph";
import { TopoSorter } from "../../../src/domain/topological-sorting";
import { QuarkConfig } from "../../../src/ports/config";

describe("ProdPublishApplication", () => {
    let app: ProdPublishApplication;
    let mockLogger: jest.Mocked<Logger>;
    let mockGit: jest.Mocked<GitService>;
    let mockGraphProvider: jest.Mocked<GraphProvider>;
    let mockAdapter: jest.Mocked<PlatformProdPublishAdapter>;

    const sampleGraph: Graph = {
        adjacency: { "pkg-a": [], "pkg-b": ["pkg-a"] },
        metadata: {
            "pkg-a": { rootDir: "/repo/packages/a", platform: "node" },
            "pkg-b": { rootDir: "/repo/packages/b", platform: "node" },
        },
    };

    const quarkConfig: QuarkConfig = {
        release: {
            masterBranch: "main",
            autoCommit: false,
            autoBump: true,
            freeze: false,
        },
    };

    beforeEach(() => {
        mockLogger = {
            info: jest.fn(),
            success: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        mockGit = {
            getRepositoryRoot: jest.fn(),
            getCurrentBranch: jest.fn(),
            fetch: jest.fn(),
            commitsBehind: jest.fn(),
            getChangedFiles: jest.fn(),
            readFile: jest.fn(),
            readFileFromRef: jest.fn(),
            getTags: jest.fn(),
        };

        mockGraphProvider = {
            build: jest.fn(),
            getInvertedAdjacencyList: jest.fn(),
            getPackageJson: jest.fn(),
        };

        mockAdapter = {
            supports: jest.fn(),
            readPackageIdentity: jest.fn(),
            versionExistsInRegistry: jest.fn(),
            publish: jest.fn(),
        };

        app = new ProdPublishApplication(
            mockLogger,
            mockGit,
            mockGraphProvider,
            [mockAdapter],
            new TopoSorter(),
            quarkConfig
        );
    });

    describe("execute", () => {
        it("should_publishChangedPackages_whenValidAndNotYetInRegistry", async () => {
            // given
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getTags.mockResolvedValue(["v1.0.0", "v1.1.0"]);
            mockGit.readFileFromRef
                .mockResolvedValueOnce(
                    JSON.stringify({
                        "pkg-a": { newVersion: "1.0.0" },
                    })
                )
                .mockResolvedValueOnce(
                    JSON.stringify({
                        "pkg-a": { newVersion: "1.1.0" },
                    })
                );
            mockAdapter.supports.mockReturnValue(true);
            mockAdapter.readPackageIdentity.mockResolvedValue({
                name: "@scope/pkg-a",
                version: "1.1.0",
            });
            mockAdapter.versionExistsInRegistry.mockResolvedValue(false);
            mockAdapter.publish.mockResolvedValue(undefined);

            // when
            await app.execute();

            // then
            expect(mockAdapter.publish).toHaveBeenCalledWith(
                "/repo/packages/a"
            );
            expect(mockAdapter.publish).toHaveBeenCalledTimes(1);
            expect(mockLogger.success).toHaveBeenCalledWith(
                expect.stringContaining("Published 1 package(s)")
            );
        });

        it("should_publishMultiplePackages_whenMultipleChanged", async () => {
            // given
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getTags.mockResolvedValue(["v1.0.0", "v1.1.0"]);
            mockGit.readFileFromRef
                .mockResolvedValueOnce(JSON.stringify({}))
                .mockResolvedValueOnce(
                    JSON.stringify({
                        "pkg-a": { newVersion: "1.0.0" },
                        "pkg-b": { newVersion: "2.0.0" },
                    })
                );
            mockAdapter.supports.mockReturnValue(true);
            mockAdapter.readPackageIdentity
                .mockResolvedValueOnce({
                    name: "@scope/pkg-a",
                    version: "1.0.0",
                })
                .mockResolvedValueOnce({
                    name: "@scope/pkg-b",
                    version: "2.0.0",
                });
            mockAdapter.versionExistsInRegistry.mockResolvedValue(false);
            mockAdapter.publish.mockResolvedValue(undefined);

            // when
            await app.execute();

            // then
            expect(mockAdapter.publish).toHaveBeenCalledTimes(2);
            expect(mockLogger.success).toHaveBeenCalledWith(
                expect.stringContaining("Published 2 package(s)")
            );
        });

        it("should_publishAllPackagesInMap_whenSingleTagFirstRelease", async () => {
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getTags.mockResolvedValue([null, "v1.0.0"]);
            mockGit.readFileFromRef.mockResolvedValue(
                JSON.stringify({
                    "pkg-a": { newVersion: "1.0.0" },
                })
            );
            mockAdapter.supports.mockReturnValue(true);
            mockAdapter.readPackageIdentity.mockResolvedValue({
                name: "@scope/pkg-a",
                version: "1.0.0",
            });
            mockAdapter.versionExistsInRegistry.mockResolvedValue(false);
            mockAdapter.publish.mockResolvedValue(undefined);

            await app.execute();

            expect(mockGit.readFileFromRef).toHaveBeenCalledTimes(1);
            expect(mockGit.readFileFromRef).toHaveBeenCalledWith(
                ".release/map.json",
                "v1.0.0"
            );
            expect(mockAdapter.publish).toHaveBeenCalledTimes(1);
            expect(mockAdapter.publish).toHaveBeenCalledWith(
                "/repo/packages/a"
            );
        });

        it("should_earlyReturn_whenNoChangesDetectedBetweenTags", async () => {
            // given
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getTags.mockResolvedValue(["v1.0.0", "v1.1.0"]);
            const identicalMap = JSON.stringify({
                "pkg-a": { newVersion: "1.0.0" },
            });
            mockGit.readFileFromRef.mockResolvedValue(identicalMap);

            // when
            await app.execute();

            // then
            expect(mockAdapter.publish).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("No package changes detected")
            );
        });

        it("should_throwError_whenVersionAlreadyExistsInRegistry", async () => {
            // given
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getTags.mockResolvedValue(["v1.0.0", "v1.1.0"]);
            mockGit.readFileFromRef
                .mockResolvedValueOnce(JSON.stringify({}))
                .mockResolvedValueOnce(
                    JSON.stringify({
                        "pkg-a": { newVersion: "1.0.0" },
                    })
                );
            mockAdapter.supports.mockReturnValue(true);
            mockAdapter.readPackageIdentity.mockResolvedValue({
                name: "@scope/pkg-a",
                version: "1.0.0",
            });
            mockAdapter.versionExistsInRegistry.mockResolvedValue(true);

            // when / then
            await expect(app.execute()).rejects.toThrow(
                "already exists in prod registry"
            );
            expect(mockAdapter.publish).not.toHaveBeenCalled();
        });

        it("should_abortAllPublishes_whenAnyVersionConflictFound", async () => {
            // given – two changed packages, second one has a conflict
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getTags.mockResolvedValue(["v1.0.0", "v1.1.0"]);
            mockGit.readFileFromRef
                .mockResolvedValueOnce(JSON.stringify({}))
                .mockResolvedValueOnce(
                    JSON.stringify({
                        "pkg-a": { newVersion: "1.0.0" },
                        "pkg-b": { newVersion: "2.0.0" },
                    })
                );
            mockAdapter.supports.mockReturnValue(true);
            mockAdapter.readPackageIdentity
                .mockResolvedValueOnce({
                    name: "@scope/pkg-a",
                    version: "1.0.0",
                })
                .mockResolvedValueOnce({
                    name: "@scope/pkg-b",
                    version: "2.0.0",
                });
            mockAdapter.versionExistsInRegistry
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(true);

            // when / then
            await expect(app.execute()).rejects.toThrow(
                "already exists in prod registry"
            );
            expect(mockAdapter.publish).not.toHaveBeenCalled();
        });

        it("should_skipPackage_whenNoAdapterSupportsItsPlatform", async () => {
            // given
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getTags.mockResolvedValue(["v1.0.0", "v1.1.0"]);
            mockGit.readFileFromRef
                .mockResolvedValueOnce(JSON.stringify({}))
                .mockResolvedValueOnce(
                    JSON.stringify({
                        "pkg-a": { newVersion: "1.0.0" },
                    })
                );
            mockAdapter.supports.mockReturnValue(false);

            // when
            await app.execute();

            // then
            expect(mockAdapter.publish).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("No prod-publish adapter")
            );
        });

        it("should_skipPackage_whenNotFoundInGraphMetadata", async () => {
            // given – graph has no metadata for "unknown-pkg"
            const emptyGraph: Graph = { adjacency: {}, metadata: {} };
            mockGraphProvider.build.mockResolvedValue(emptyGraph);
            mockGit.getTags.mockResolvedValue(["v1.0.0", "v1.1.0"]);
            mockGit.readFileFromRef
                .mockResolvedValueOnce(JSON.stringify({}))
                .mockResolvedValueOnce(
                    JSON.stringify({
                        "unknown-pkg": { newVersion: "1.0.0" },
                    })
                );

            // when
            await app.execute();

            // then
            expect(mockAdapter.publish).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("not found in graph")
            );
        });

        it("should_passTargetTag_toGetTags_whenProvided", async () => {
            // given
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getTags.mockResolvedValue(["v1.0.0", "v1.1.0"]);
            const identicalMap = JSON.stringify({});
            mockGit.readFileFromRef.mockResolvedValue(identicalMap);

            // when
            await app.execute("v1.1.0");

            // then
            expect(mockGit.getTags).toHaveBeenCalledWith("v1.1.0");
        });

        it("should_detectNewlyAddedPackages_inLatestMap", async () => {
            // given – pkg-a is in new map but not old map
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getTags.mockResolvedValue(["v1.0.0", "v1.1.0"]);
            mockGit.readFileFromRef
                .mockResolvedValueOnce(
                    JSON.stringify({
                        "pkg-b": { newVersion: "1.0.0" },
                    })
                )
                .mockResolvedValueOnce(
                    JSON.stringify({
                        "pkg-a": { newVersion: "1.0.0" },
                        "pkg-b": { newVersion: "1.0.0" },
                    })
                );
            mockAdapter.supports.mockReturnValue(true);
            mockAdapter.readPackageIdentity.mockResolvedValue({
                name: "@scope/pkg-a",
                version: "1.0.0",
            });
            mockAdapter.versionExistsInRegistry.mockResolvedValue(false);
            mockAdapter.publish.mockResolvedValue(undefined);

            // when
            await app.execute();

            // then – only pkg-a is new/changed
            expect(mockAdapter.publish).toHaveBeenCalledTimes(1);
        });

        it("should_publishDependenciesBeforeDependents_whenTopoSorted", async () => {
            // given – both packages bumped; pkg-b depends on pkg-a
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getTags.mockResolvedValue(["v1.0.0", "v1.1.0"]);
            mockGit.readFileFromRef
                .mockResolvedValueOnce(
                    JSON.stringify({
                        "pkg-a": { newVersion: "1.0.0" },
                        "pkg-b": { newVersion: "1.0.0" },
                    })
                )
                .mockResolvedValueOnce(
                    JSON.stringify({
                        "pkg-a": { newVersion: "2.0.0" },
                        "pkg-b": { newVersion: "2.0.0" },
                    })
                );
            mockAdapter.supports.mockReturnValue(true);
            mockAdapter.readPackageIdentity
                .mockResolvedValueOnce({
                    name: "@scope/pkg-a",
                    version: "2.0.0",
                })
                .mockResolvedValueOnce({
                    name: "@scope/pkg-b",
                    version: "2.0.0",
                });
            mockAdapter.versionExistsInRegistry.mockResolvedValue(false);
            mockAdapter.publish.mockResolvedValue(undefined);

            // when
            await app.execute();

            // then
            expect(mockAdapter.publish).toHaveBeenNthCalledWith(
                1,
                "/repo/packages/a"
            );
            expect(mockAdapter.publish).toHaveBeenNthCalledWith(
                2,
                "/repo/packages/b"
            );
        });

        it("should_skipSameVersionUnfrozenMapOnlyUpdate_whenReleaseFreezeEnabled", async () => {
            // given
            const freezeApp = new ProdPublishApplication(
                mockLogger,
                mockGit,
                mockGraphProvider,
                [mockAdapter],
                new TopoSorter(),
                {
                    ...quarkConfig,
                    release: { ...quarkConfig.release, freeze: true },
                }
            );
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getTags.mockResolvedValue(["v1.0.0", "v1.1.0"]);
            mockGit.readFileFromRef
                .mockResolvedValueOnce(
                    JSON.stringify({
                        "pkg-a": {
                            newVersion: "1.0.0",
                            frozen: false,
                            changeLog: "old",
                        },
                    })
                )
                .mockResolvedValueOnce(
                    JSON.stringify({
                        "pkg-a": {
                            newVersion: "1.0.0",
                            frozen: false,
                            changeLog: "new",
                        },
                    })
                );

            // when
            await freezeApp.execute();

            // then
            expect(mockAdapter.publish).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(
                    "No packages qualify for prod publish after freeze policy"
                )
            );
        });

        it("should_publishUnfrozenPackage_whenVersionBumpedAndReleaseFreezeEnabled", async () => {
            // given
            const freezeApp = new ProdPublishApplication(
                mockLogger,
                mockGit,
                mockGraphProvider,
                [mockAdapter],
                new TopoSorter(),
                {
                    ...quarkConfig,
                    release: { ...quarkConfig.release, freeze: true },
                }
            );
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getTags.mockResolvedValue(["v1.0.0", "v1.1.0"]);
            mockGit.readFileFromRef
                .mockResolvedValueOnce(
                    JSON.stringify({
                        "pkg-a": {
                            newVersion: "1.0.0",
                            frozen: false,
                        },
                    })
                )
                .mockResolvedValueOnce(
                    JSON.stringify({
                        "pkg-a": {
                            newVersion: "2.0.0",
                            frozen: false,
                        },
                    })
                );
            mockAdapter.supports.mockReturnValue(true);
            mockAdapter.readPackageIdentity.mockResolvedValue({
                name: "@scope/pkg-a",
                version: "2.0.0",
            });
            mockAdapter.versionExistsInRegistry.mockResolvedValue(false);
            mockAdapter.publish.mockResolvedValue(undefined);

            // when
            await freezeApp.execute();

            // then
            expect(mockAdapter.publish).toHaveBeenCalledTimes(1);
            expect(mockAdapter.publish).toHaveBeenCalledWith(
                "/repo/packages/a"
            );
        });
    });
});
