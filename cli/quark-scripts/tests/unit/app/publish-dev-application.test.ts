jest.mock("prompts", () => {
    const fn = jest.fn();
    return { __esModule: true, default: fn };
});

import prompts from "prompts";
import { PublishDevApplication } from "../../../src/app/publish-dev-application";
import { Logger } from "../../../src/ports/logger";
import { GitService } from "../../../src/ports/git";
import { GraphProvider } from "../../../src/ports/graph";
import { PlatformDevPublishAdapter } from "../../../src/ports/platform-dev-publish-adapter";
import { Graph } from "../../../src/domain/graph";

const mockPrompts = prompts as unknown as jest.Mock;

describe("PublishDevApplication", () => {
    let app: PublishDevApplication;
    let mockLogger: jest.Mocked<Logger>;
    let mockGit: jest.Mocked<GitService>;
    let mockGraphProvider: jest.Mocked<GraphProvider>;
    let mockAdapter: jest.Mocked<PlatformDevPublishAdapter>;

    const sampleGraph: Graph = {
        adjacency: { "pkg-a": [], "pkg-b": [] },
        metadata: {
            "pkg-a": { rootDir: "/repo/packages/a", platform: "node" },
            "pkg-b": { rootDir: "/repo/packages/b", platform: "node" },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();

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
            getCurrentVersion: jest.fn(),
            publish: jest.fn(),
        };

        app = new PublishDevApplication(
            mockLogger,
            mockGit,
            mockGraphProvider,
            [mockAdapter],
            "main"
        );
    });

    describe("execute", () => {
        it("should_publishAlphaVersion_whenPackageSelected", async () => {
            // given
            mockGit.getRepositoryRoot.mockResolvedValue("/repo");
            mockGit.getCurrentBranch.mockResolvedValue("feature-branch");
            mockGit.fetch.mockResolvedValue(undefined);
            mockGit.commitsBehind.mockResolvedValue(0);
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getChangedFiles.mockResolvedValue([
                "packages/a/src/index.ts",
            ]);
            mockPrompts.mockResolvedValue({ packageName: "pkg-a" });
            mockAdapter.getCurrentVersion.mockResolvedValue("1.2.3");
            mockAdapter.publish.mockResolvedValue(undefined);

            // when
            await app.execute();

            // then
            expect(mockAdapter.getCurrentVersion).toHaveBeenCalledWith(
                "/repo/packages/a"
            );
            expect(mockAdapter.publish).toHaveBeenCalledWith(
                expect.objectContaining({
                    packageName: "pkg-a",
                    packageDir: "/repo/packages/a",
                    repoRoot: "/repo",
                }),
                expect.stringMatching(/^1\.2\.3-alpha\.\d+$/)
            );
        });

        it("should_earlyReturn_whenNoPackagesChanged", async () => {
            // given
            mockGit.getRepositoryRoot.mockResolvedValue("/repo");
            mockGit.getCurrentBranch.mockResolvedValue("feature-branch");
            mockGit.fetch.mockResolvedValue(undefined);
            mockGit.commitsBehind.mockResolvedValue(0);
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getChangedFiles.mockResolvedValue([]);

            // when
            await app.execute();

            // then
            expect(mockAdapter.publish).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Nothing to publish")
            );
        });

        it("should_throwError_whenNoAdapterSupportsPackagePlatform", async () => {
            // given
            mockGit.getRepositoryRoot.mockResolvedValue("/repo");
            mockGit.getCurrentBranch.mockResolvedValue("feature-branch");
            mockGit.fetch.mockResolvedValue(undefined);
            mockGit.commitsBehind.mockResolvedValue(0);
            mockGraphProvider.build.mockResolvedValue(sampleGraph);
            mockGit.getChangedFiles.mockResolvedValue([
                "packages/a/src/index.ts",
            ]);
            mockPrompts.mockResolvedValue({ packageName: "pkg-a" });
            mockAdapter.supports.mockReturnValue(false);

            // when / then
            await expect(app.execute()).rejects.toThrow(
                /No dev-publish adapter/
            );
        });

        it("should_throwError_whenBranchIsBehindMaster", async () => {
            // given
            mockGit.getRepositoryRoot.mockResolvedValue("/repo");
            mockGit.getCurrentBranch.mockResolvedValue("feature-branch");
            mockGit.fetch.mockResolvedValue(undefined);
            mockGit.commitsBehind.mockResolvedValue(2);

            // when / then
            await expect(app.execute()).rejects.toThrow(
                /2 commits behind/
            );
        });
    });
});
