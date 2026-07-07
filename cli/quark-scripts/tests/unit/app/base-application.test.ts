import { BaseApplication } from "../../../src/app/base-application";
import { Logger } from "../../../src/ports/logger";
import { GitService } from "../../../src/ports/git";
import { GraphProvider } from "../../../src/ports/graph";
import { Graph, PackageMetadataMap } from "../../../src/domain/graph";

class TestableApplication extends BaseApplication {
    async callEnsureRepositoryHealthy() {
        return this.ensureRepositoryHealthy();
    }
    async callBuildGraph() {
        return this.buildGraph();
    }
    async callGetChangedAbsolutePaths(repoRoot: string) {
        return this.getChangedAbsolutePaths(repoRoot);
    }
    callIsPackageAffected(packageDir: string, changedFiles: string[]) {
        return this.isPackageAffected(packageDir, changedFiles);
    }
    callMapFilesToPackages(
        changedFiles: string[],
        metadata: PackageMetadataMap
    ) {
        return this.mapFilesToPackages(changedFiles, metadata);
    }
    callFindOwningPackage(file: string, metadata: PackageMetadataMap) {
        return this.findOwningPackage(file, metadata);
    }
}

describe("BaseApplication", () => {
    let app: TestableApplication;
    let mockLogger: jest.Mocked<Logger>;
    let mockGit: jest.Mocked<GitService>;
    let mockGraphProvider: jest.Mocked<GraphProvider>;

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

        app = new TestableApplication(
            mockLogger,
            mockGit,
            mockGraphProvider,
            "main"
        );
    });

    describe("ensureRepositoryHealthy", () => {
        it("should_returnRepoRoot_whenBranchIsUpToDate", async () => {
            // given
            mockGit.getRepositoryRoot.mockResolvedValue("/repo");
            mockGit.getCurrentBranch.mockResolvedValue("feature-x");
            mockGit.fetch.mockResolvedValue(undefined);
            mockGit.commitsBehind.mockResolvedValue(0);

            // when
            const result = await app.callEnsureRepositoryHealthy();

            // then
            expect(result).toBe("/repo");
            expect(mockGit.fetch).toHaveBeenCalledWith("main");
            expect(mockGit.commitsBehind).toHaveBeenCalledWith("main");
        });

        it("should_throwError_whenBranchIsBehind", async () => {
            // given
            mockGit.getRepositoryRoot.mockResolvedValue("/repo");
            mockGit.getCurrentBranch.mockResolvedValue("feature-x");
            mockGit.fetch.mockResolvedValue(undefined);
            mockGit.commitsBehind.mockResolvedValue(3);

            // when / then
            await expect(app.callEnsureRepositoryHealthy()).rejects.toThrow(
                /3 commits behind/
            );
        });
    });

    describe("buildGraph", () => {
        it("should_returnGraph_whenGraphIsValid", async () => {
            // given
            const graph: Graph = {
                adjacency: { "pkg-a": [] },
                metadata: {
                    "pkg-a": { rootDir: "/repo/a", platform: "node" },
                },
            };
            mockGraphProvider.build.mockResolvedValue(graph);

            // when
            const result = await app.callBuildGraph();

            // then
            expect(result).toEqual(graph);
        });

        it("should_throwError_whenGraphIsEmpty", async () => {
            // given
            mockGraphProvider.build.mockResolvedValue({
                adjacency: {},
                metadata: {},
            });

            // when / then
            await expect(app.callBuildGraph()).rejects.toThrow(
                "Dependency graph is empty"
            );
        });

        it("should_throwError_whenGraphIsNull", async () => {
            // given
            mockGraphProvider.build.mockResolvedValue(
                null as unknown as Graph
            );

            // when / then
            await expect(app.callBuildGraph()).rejects.toThrow(
                "Dependency graph is empty"
            );
        });
    });

    describe("getChangedAbsolutePaths", () => {
        it("should_resolveRelativePathsToAbsolute", async () => {
            // given
            mockGit.getChangedFiles.mockResolvedValue([
                "packages/a/src/index.ts",
                "packages/b/README.md",
            ]);

            // when
            const result = await app.callGetChangedAbsolutePaths("/repo");

            // then
            expect(result).toEqual([
                "/repo/packages/a/src/index.ts",
                "/repo/packages/b/README.md",
            ]);
        });

        it("should_returnEmptyArray_whenNoFilesChanged", async () => {
            // given
            mockGit.getChangedFiles.mockResolvedValue([]);

            // when
            const result = await app.callGetChangedAbsolutePaths("/repo");

            // then
            expect(result).toEqual([]);
        });
    });

    describe("isPackageAffected", () => {
        it("should_returnTrue_whenFileIsInsidePackageDir", () => {
            // given
            const changedFiles = ["/repo/packages/a/src/index.ts"];

            // when / then
            expect(
                app.callIsPackageAffected("/repo/packages/a", changedFiles)
            ).toBe(true);
        });

        it("should_returnFalse_whenFileIsOutsidePackageDir", () => {
            // given
            const changedFiles = ["/repo/packages/b/src/index.ts"];

            // when / then
            expect(
                app.callIsPackageAffected("/repo/packages/a", changedFiles)
            ).toBe(false);
        });

        it("should_returnFalse_whenDirIsPrefix_butNotParent", () => {
            // "/repo/packages/ab/file" should NOT match "/repo/packages/a"
            const changedFiles = ["/repo/packages/ab/file.ts"];

            // when / then
            expect(
                app.callIsPackageAffected("/repo/packages/a", changedFiles)
            ).toBe(false);
        });
    });

    describe("mapFilesToPackages", () => {
        const metadata: PackageMetadataMap = {
            "pkg-a": { rootDir: "/repo/packages/a", platform: "node" },
            "pkg-b": { rootDir: "/repo/packages/b", platform: "node" },
        };

        it("should_returnAffectedPackages_whenFilesMatchPackageDirs", () => {
            // given
            const changedFiles = [
                "/repo/packages/a/src/index.ts",
                "/repo/packages/b/package.json",
            ];

            // when
            const result = app.callMapFilesToPackages(changedFiles, metadata);

            // then
            expect(result).toEqual(new Set(["pkg-a", "pkg-b"]));
        });

        it("should_deduplicatePackages_whenMultipleFilesInSamePackage", () => {
            // given
            const changedFiles = [
                "/repo/packages/a/src/index.ts",
                "/repo/packages/a/src/utils.ts",
            ];

            // when
            const result = app.callMapFilesToPackages(changedFiles, metadata);

            // then
            expect(result).toEqual(new Set(["pkg-a"]));
        });

        it("should_ignoreFiles_thatBelongToNoPackage", () => {
            // given
            const changedFiles = ["/repo/README.md"];

            // when
            const result = app.callMapFilesToPackages(changedFiles, metadata);

            // then
            expect(result.size).toBe(0);
        });
    });

    describe("findOwningPackage", () => {
        it("should_returnLongestPrefixMatch_whenNestedPackages", () => {
            // given – nested packages (monorepo with sub-packages)
            const metadata: PackageMetadataMap = {
                parent: {
                    rootDir: "/repo/packages/components",
                    platform: "node",
                },
                child: {
                    rootDir: "/repo/packages/components/button",
                    platform: "node",
                },
            };

            // when
            const result = app.callFindOwningPackage(
                "/repo/packages/components/button/src/index.ts",
                metadata
            );

            // then – child is the more specific match
            expect(result).toBe("child");
        });

        it("should_returnNull_whenNoPackageOwnsFile", () => {
            // given
            const metadata: PackageMetadataMap = {
                "pkg-a": { rootDir: "/repo/packages/a", platform: "node" },
            };

            // when
            const result = app.callFindOwningPackage(
                "/repo/unrelated/file.ts",
                metadata
            );

            // then
            expect(result).toBeNull();
        });
    });
});
