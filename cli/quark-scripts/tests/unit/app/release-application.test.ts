import { ReleaseApplication } from "../../../src/app/release-application";
import { Logger } from "../../../src/ports/logger";
import { GitService } from "../../../src/ports/git";
import { GraphProvider } from "../../../src/ports/graph";
import { PlatformReleaseAdapter } from "../../../src/ports/platform-release-adapter";
import { TopoSorter } from "../../../src/domain/topological-sorting";
import { ReleaseMapStore } from "../../../src/ports/release-map-store";
import { Graph } from "../../../src/domain/graph";
import { PromptResult } from "../../../src/ports/prompts";
import { mergeReleaseMaps } from "../../../src/infrastructure/release/git-release-map-store";

describe("ReleaseApplication", () => {
    let app: ReleaseApplication;
    let mockLogger: jest.Mocked<Logger>;
    let mockGit: jest.Mocked<GitService>;
    let mockGraphProvider: jest.Mocked<GraphProvider>;
    let mockAdapter: jest.Mocked<PlatformReleaseAdapter>;
    let mockTopoSorter: jest.Mocked<TopoSorter>;
    let mockReleaseMapStore: jest.Mocked<ReleaseMapStore>;

    const sampleGraph: Graph = {
        adjacency: {
            "pkg-a": [],
            "pkg-b": ["pkg-a"],
            "pkg-c": ["pkg-b"],
        },
        metadata: {
            "pkg-a": { rootDir: "/repo/packages/a", platform: "node" },
            "pkg-b": { rootDir: "/repo/packages/b", platform: "node" },
            "pkg-c": { rootDir: "/repo/packages/c", platform: "node" },
        },
    };

    const samplePromptResult: PromptResult = {
        bump: "patch",
        frozen: false,
        baseVersion: "1.0.0",
        newVersion: "1.0.1",
        changelog: "Bug fix",
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
            supports: jest.fn().mockReturnValue(true),
            execute: jest.fn(),
            writeUserPromptsToFiles: jest.fn(),
        };

        mockTopoSorter = {
            sort: jest.fn(),
        } as jest.Mocked<TopoSorter>;

        mockReleaseMapStore = {
            read: jest.fn(),
            readLocal: jest.fn(),
            readMergedWithLocal: jest.fn(),
            write: jest.fn(),
        };
        mockReleaseMapStore.readMergedWithLocal.mockImplementation(
            async (branch: string) =>
                mergeReleaseMaps(
                    await mockReleaseMapStore.read(branch),
                    await mockReleaseMapStore.readLocal()
                )
        );
        mockReleaseMapStore.readLocal.mockResolvedValue({});

        app = new ReleaseApplication(
            mockLogger,
            mockGit,
            mockGraphProvider,
            [mockAdapter],
            mockTopoSorter,
            mockReleaseMapStore,
            "main"
        );
    });

    describe("execute", () => {
        it("should_runFullReleaseFlow_whenPackagesAreAffected", async () => {
            // given
            mockGit.getRepositoryRoot.mockResolvedValue("/repo");
            mockGit.getCurrentBranch.mockResolvedValue("release-branch");
            mockGit.fetch.mockResolvedValue(undefined);
            mockGit.commitsBehind.mockResolvedValue(0);
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getChangedFiles.mockResolvedValue([
                "packages/a/src/index.ts",
            ]);
            mockTopoSorter.sort.mockReturnValue(["pkg-a", "pkg-b", "pkg-c"]);
            mockReleaseMapStore.read.mockResolvedValue({});
            mockAdapter.execute.mockResolvedValue({
                "pkg-a": samplePromptResult,
            });
            mockAdapter.writeUserPromptsToFiles.mockResolvedValue(undefined);
            mockReleaseMapStore.write.mockResolvedValue(undefined);

            // when
            await app.execute();

            // then
            expect(mockGit.fetch).toHaveBeenCalledWith("main");
            expect(mockGraphProvider.build).toHaveBeenCalled();
            expect(mockTopoSorter.sort).toHaveBeenCalled();
            expect(mockAdapter.execute).toHaveBeenCalled();
            expect(mockAdapter.writeUserPromptsToFiles).toHaveBeenCalledWith(
                "pkg-a",
                samplePromptResult,
                expect.any(Object),
                sampleGraph
            );
            expect(mockReleaseMapStore.write).toHaveBeenCalled();
        });

        it("should_throwError_whenBranchIsBehindMaster", async () => {
            // given
            mockGit.getRepositoryRoot.mockResolvedValue("/repo");
            mockGit.getCurrentBranch.mockResolvedValue("feature-branch");
            mockGit.fetch.mockResolvedValue(undefined);
            mockGit.commitsBehind.mockResolvedValue(5);

            // when / then
            await expect(app.execute()).rejects.toThrow(
                /5 commits behind/
            );
            expect(mockAdapter.execute).not.toHaveBeenCalled();
        });

        it("should_throwError_whenGraphIsEmpty", async () => {
            // given
            mockGit.getRepositoryRoot.mockResolvedValue("/repo");
            mockGit.getCurrentBranch.mockResolvedValue("feature-branch");
            mockGit.fetch.mockResolvedValue(undefined);
            mockGit.commitsBehind.mockResolvedValue(0);
            mockGraphProvider.build.mockResolvedValue({
                adjacency: {},
                metadata: {},
            });

            // when / then
            await expect(app.execute()).rejects.toThrow(
                "Dependency graph is empty"
            );
        });

        it("should_onlyIncludeDirectlyChangedPackages_notDependents", async () => {
            // given – only pkg-a changed; pkg-b / pkg-c are not in the "affected" set
            // (dependents are added on major bump inside the adapter, not here)
            mockGit.getRepositoryRoot.mockResolvedValue("/repo");
            mockGit.getCurrentBranch.mockResolvedValue("release-branch");
            mockGit.fetch.mockResolvedValue(undefined);
            mockGit.commitsBehind.mockResolvedValue(0);
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getChangedFiles.mockResolvedValue([
                "packages/a/src/index.ts",
            ]);
            mockTopoSorter.sort.mockReturnValue(["pkg-a"]);
            mockReleaseMapStore.read.mockResolvedValue({});
            mockAdapter.execute.mockResolvedValue({});
            mockReleaseMapStore.write.mockResolvedValue(undefined);

            // when
            await app.execute();

            // then – topo sort only receives directly changed packages
            const sortCall = mockTopoSorter.sort.mock.calls[0];
            const nodesPassedToSort = sortCall[1] as string[];
            expect(nodesPassedToSort).toEqual(["pkg-a"]);
        });

        it("should_readMergedMap_fromMainAndLocal_forPrompts", async () => {
            // given
            mockGit.getRepositoryRoot.mockResolvedValue("/repo");
            mockGit.getCurrentBranch.mockResolvedValue("release-branch");
            mockGit.fetch.mockResolvedValue(undefined);
            mockGit.commitsBehind.mockResolvedValue(0);
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getChangedFiles.mockResolvedValue([
                "packages/a/src/index.ts",
            ]);
            mockTopoSorter.sort.mockReturnValue(["pkg-a"]);
            mockReleaseMapStore.read.mockResolvedValue({});
            mockReleaseMapStore.readLocal.mockResolvedValue({});
            mockAdapter.execute.mockResolvedValue({});
            mockReleaseMapStore.write.mockResolvedValue(undefined);

            // when
            await app.execute();

            // then
            expect(mockReleaseMapStore.readMergedWithLocal).toHaveBeenCalledWith(
                "main"
            );
        });

        it("should_skipAdapter_whenNoAdapterSupportsPackage", async () => {
            // given
            mockGit.getRepositoryRoot.mockResolvedValue("/repo");
            mockGit.getCurrentBranch.mockResolvedValue("release-branch");
            mockGit.fetch.mockResolvedValue(undefined);
            mockGit.commitsBehind.mockResolvedValue(0);
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getChangedFiles.mockResolvedValue([
                "packages/a/src/index.ts",
            ]);
            mockTopoSorter.sort.mockReturnValue(["pkg-a"]);
            mockReleaseMapStore.read.mockResolvedValue({});
            mockAdapter.supports.mockReturnValue(false);
            mockReleaseMapStore.write.mockResolvedValue(undefined);

            // when
            await app.execute();

            // then
            expect(mockAdapter.execute).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("No adapter found")
            );
        });
    });
});
