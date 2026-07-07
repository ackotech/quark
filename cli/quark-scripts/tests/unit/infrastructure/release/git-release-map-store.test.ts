jest.mock("fs/promises");

import fs from "fs/promises";
import {
    GitReleaseMapStore,
    mergeReleaseMaps,
} from "../../../../src/infrastructure/release/git-release-map-store";
import { GitService } from "../../../../src/ports/git";
import { PackageMap } from "../../../../src/ports/map";

const mockMkdir = fs.mkdir as jest.MockedFunction<typeof fs.mkdir>;
const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
const mockWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;

describe("GitReleaseMapStore", () => {
    let store: GitReleaseMapStore;
    let mockGit: jest.Mocked<GitService>;

    beforeEach(() => {
        jest.clearAllMocks();

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

        store = new GitReleaseMapStore(mockGit);
    });

    describe("read", () => {
        it("should_returnParsedMap_whenFileExistsOnMaster", async () => {
            // given
            const mapData: PackageMap = {
                "pkg-a": {
                    bumpType: "patch",
                    baseVersion: "1.0.0",
                    newVersion: "1.0.1",
                    changeLog: "fix",
                    frozen: false,
                },
            };
            mockGit.readFile.mockResolvedValue(JSON.stringify(mapData));

            // when
            const result = await store.read("main");

            // then
            expect(result).toEqual(mapData);
            expect(mockGit.readFile).toHaveBeenCalledWith(
                ".release/map.json",
                "main"
            );
        });

        it("should_returnEmptyObject_whenFileNotFoundOnMaster", async () => {
            // given
            mockGit.readFile.mockRejectedValue(
                new Error("fatal: path not found")
            );

            // when
            const result = await store.read("main");

            // then
            expect(result).toEqual({});
        });

        it("should_returnEmptyObject_whenFileContainsInvalidJson", async () => {
            // given
            mockGit.readFile.mockResolvedValue("not-valid-json");

            // when
            const result = await store.read("main");

            // then
            expect(result).toEqual({});
        });

        it("should_useBranchName_passedAsArgument", async () => {
            // given
            mockGit.readFile.mockResolvedValue("{}");

            // when
            await store.read("develop");

            // then
            expect(mockGit.readFile).toHaveBeenCalledWith(
                ".release/map.json",
                "develop"
            );
        });
    });

    describe("readLocal", () => {
        it("should_returnParsedMap_fromLocalFile", async () => {
            // given
            const mapData: PackageMap = {
                "pkg-a": {
                    bumpType: "patch",
                    baseVersion: "1.0.0",
                    newVersion: "1.0.1",
                    changeLog: "fix",
                    frozen: false,
                },
            };
            mockReadFile.mockResolvedValue(
                JSON.stringify(mapData) as any
            );

            // when
            const result = await store.readLocal();

            // then
            expect(result).toEqual(mapData);
            expect(mockReadFile).toHaveBeenCalledWith(
                expect.stringContaining("map.json"),
                "utf8"
            );
        });

        it("should_returnEmptyObject_whenLocalFileNotFound", async () => {
            // given
            mockReadFile.mockRejectedValue(new Error("ENOENT"));

            // when
            const result = await store.readLocal();

            // then
            expect(result).toEqual({});
        });
    });

    describe("mergeReleaseMaps", () => {
        it("should_overlayLocalFields_overMainPerPackage", () => {
            const main = {
                "pkg-a": {
                    bumpType: "minor" as const,
                    baseVersion: "1.0.0",
                    newVersion: "1.1.0",
                    changeLog: "x",
                    frozen: true,
                },
            };
            const local = {
                "pkg-a": {
                    bumpType: "minor" as const,
                    baseVersion: "1.0.0",
                    newVersion: "1.1.0",
                    changeLog: "x",
                    frozen: false,
                },
            };
            expect(mergeReleaseMaps(main, local)["pkg-a"].frozen).toBe(false);
        });

        it("should_unionPackageKeys_fromBothMaps", () => {
            const main = {
                a: {
                    bumpType: "patch" as const,
                    baseVersion: "1.0.0",
                    newVersion: "1.0.1",
                    changeLog: "",
                    frozen: false,
                },
            };
            const local = {
                b: {
                    bumpType: "patch" as const,
                    baseVersion: "2.0.0",
                    newVersion: "2.0.1",
                    changeLog: "",
                    frozen: false,
                },
            };
            const merged = mergeReleaseMaps(main, local);
            expect(Object.keys(merged).sort()).toEqual(["a", "b"]);
        });
    });

    describe("readMergedWithLocal", () => {
        it("should_returnMergeOfReadAndReadLocal", async () => {
            const mainMap: PackageMap = {
                "pkg-a": {
                    bumpType: "patch",
                    baseVersion: "1.0.0",
                    newVersion: "1.0.1",
                    changeLog: "m",
                    frozen: true,
                },
            };
            const localMap: PackageMap = {
                "pkg-a": {
                    bumpType: "patch",
                    baseVersion: "1.0.0",
                    newVersion: "1.0.1",
                    changeLog: "m",
                    frozen: false,
                },
            };
            mockGit.readFile.mockResolvedValue(JSON.stringify(mainMap));
            mockReadFile.mockResolvedValue(JSON.stringify(localMap) as any);

            const result = await store.readMergedWithLocal("main");

            expect(result["pkg-a"].frozen).toBe(false);
            expect(mockGit.readFile).toHaveBeenCalledWith(
                ".release/map.json",
                "main"
            );
        });
    });

    describe("write", () => {
        it("should_createDirectoryAndWriteFile", async () => {
            // given
            const mapData: PackageMap = {
                "pkg-a": {
                    bumpType: "minor",
                    baseVersion: "1.0.0",
                    newVersion: "1.1.0",
                    changeLog: "feature",
                    frozen: false,
                },
            };
            mockMkdir.mockResolvedValue(undefined);
            mockWriteFile.mockResolvedValue(undefined);

            // when
            await store.write(mapData);

            // then
            expect(mockMkdir).toHaveBeenCalledWith(
                expect.stringContaining(".release"),
                { recursive: true }
            );
            expect(mockWriteFile).toHaveBeenCalledWith(
                expect.stringContaining("map.json"),
                JSON.stringify(mapData, null, 2),
                "utf8"
            );
        });

        it("should_writeFormattedJson", async () => {
            // given
            const mapData: PackageMap = { "pkg-x": {} as any };
            mockMkdir.mockResolvedValue(undefined);
            mockWriteFile.mockResolvedValue(undefined);

            // when
            await store.write(mapData);

            // then
            const writtenContent = mockWriteFile.mock.calls[0][1] as string;
            expect(writtenContent).toContain("\n");
            expect(writtenContent).toBe(JSON.stringify(mapData, null, 2));
        });
    });
});
