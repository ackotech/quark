jest.mock("fs");

import fs from "fs";
import { QuarkConfigProvider } from "../../../../src/infrastructure/config/quarkConfigProvider";

const mockExistsSync = fs.existsSync as jest.MockedFunction<
    typeof fs.existsSync
>;
const mockReadFileSync = fs.readFileSync as jest.MockedFunction<
    typeof fs.readFileSync
>;

describe("QuarkConfigProvider", () => {
    let provider: QuarkConfigProvider;

    beforeEach(() => {
        jest.clearAllMocks();
        provider = new QuarkConfigProvider();
    });

    describe("getConfig", () => {
        it("should_returnDefaultConfig_whenNoConfigFileExists", () => {
            // given
            mockExistsSync.mockReturnValue(false);

            // when
            const config = provider.getConfig();

            // then
            expect(config.release.masterBranch).toBe("main");
            expect(config.release.autoCommit).toBe(false);
            expect(config.release.autoBump).toBe(true);
            expect(config.release.freeze).toBe(true);
            expect(config.publish?.node?.registryUrl).toBe("");
            expect(config.publish?.node?.scope).toBe("");
            expect(config.publish?.maven?.repositoryUrl).toBe("");
            expect(config.publish?.maven?.repositoryId).toBe("");
        });

        it("should_mergePartialConfig_withDefaults", () => {
            // given
            const partial = {
                release: {
                    masterBranch: "develop",
                },
                publish: {
                    node: {
                        registryUrl: "https://my-nexus.com/npm/",
                        scope: "@myorg",
                    },
                },
            };
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(JSON.stringify(partial));

            // when
            const config = provider.getConfig();

            // then
            expect(config.release.masterBranch).toBe("develop");
            expect(config.release.autoCommit).toBe(false);
            expect(config.release.freeze).toBe(true);
            expect(config.publish?.node?.registryUrl).toBe(
                "https://my-nexus.com/npm/"
            );
            expect(config.publish?.node?.scope).toBe("@myorg");
            expect(config.publish?.maven?.repositoryUrl).toBe("");
        });

        it("should_mergeFullConfig_overridingAllDefaults", () => {
            // given
            const full = {
                release: {
                    masterBranch: "production",
                    autoCommit: true,
                    autoBump: false,
                    freeze: false,
                },
                publish: {
                    node: {
                        registryUrl: "https://r.example.com/npm/",
                        devRegistryUrl: "https://r.example.com/npm-dev/",
                        prodRegistryUrl: "https://r.example.com/npm-prod/",
                        scope: "@example",
                    },
                    maven: {
                        repositoryUrl: "https://r.example.com/mvn/",
                        devRepositoryUrl: "https://r.example.com/mvn-dev/",
                        prodRepositoryUrl: "https://r.example.com/mvn-prod/",
                        repositoryId: "releases",
                    },
                },
            };
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(JSON.stringify(full));

            // when
            const config = provider.getConfig();

            // then
            expect(config.release.masterBranch).toBe("production");
            expect(config.release.autoCommit).toBe(true);
            expect(config.release.autoBump).toBe(false);
            expect(config.release.freeze).toBe(false);
            expect(config.publish?.node?.registryUrl).toBe(
                "https://r.example.com/npm/"
            );
            expect(config.publish?.node?.devRegistryUrl).toBe(
                "https://r.example.com/npm-dev/"
            );
            expect(config.publish?.node?.prodRegistryUrl).toBe(
                "https://r.example.com/npm-prod/"
            );
            expect(config.publish?.node?.scope).toBe("@example");
            expect(config.publish?.maven?.repositoryUrl).toBe(
                "https://r.example.com/mvn/"
            );
            expect(config.publish?.maven?.repositoryId).toBe("releases");
        });

        it("should_handleConfig_withOnlyReleaseSection", () => {
            // given
            const releaseOnly = {
                release: { masterBranch: "trunk" },
            };
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(JSON.stringify(releaseOnly));

            // when
            const config = provider.getConfig();

            // then
            expect(config.release.masterBranch).toBe("trunk");
            expect(config.publish?.node?.registryUrl).toBe("");
        });

        it("should_throwError_whenConfigFileContainsInvalidJson", () => {
            // given
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue("{ invalid json }");

            // when / then
            expect(() => provider.getConfig()).toThrow();
        });
    });
});
