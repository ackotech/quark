import {
    effectiveDevRegistryUrl,
    effectiveNodeScope,
    effectiveProdRegistryUrl,
    normalizeEnvString,
} from "../../../../src/infrastructure/config/nodeRegistryEnv";
import { NodePublishConfig } from "../../../../src/ports/config";

describe("nodeRegistryEnv", () => {
    describe("normalizeEnvString", () => {
        it("should_stripWhitespaceAndSingleQuotes", () => {
            expect(normalizeEnvString("  'http://localhost/a/'  ")).toBe(
                "http://localhost/a/"
            );
        });

        it("should_stripDoubleQuotes", () => {
            expect(normalizeEnvString('"http://localhost/b/"')).toBe(
                "http://localhost/b/"
            );
        });
    });

    describe("effectiveDevRegistryUrl", () => {
        const saved = process.env.DEV_REGISTRY_URL;

        afterEach(() => {
            if (saved === undefined) {
                delete process.env.DEV_REGISTRY_URL;
            } else {
                process.env.DEV_REGISTRY_URL = saved;
            }
        });

        it("should_useDevRegistryUrlFromEnv_first", () => {
            process.env.DEV_REGISTRY_URL = "https://from-env.dev/npm/";
            const node: NodePublishConfig = {
                registryUrl: "https://from-config.example/npm/",
                scope: "@x",
            };
            expect(effectiveDevRegistryUrl(node)).toBe(
                "https://from-env.dev/npm/"
            );
        });
    });

    describe("effectiveProdRegistryUrl", () => {
        const saved = process.env.PROD_REGISTRY_URL;

        afterEach(() => {
            if (saved === undefined) {
                delete process.env.PROD_REGISTRY_URL;
            } else {
                process.env.PROD_REGISTRY_URL = saved;
            }
        });

        it("should_useProdRegistryUrlFromEnv_first", () => {
            process.env.PROD_REGISTRY_URL = "https://from-env.prod/npm/";
            const node: NodePublishConfig = {
                registryUrl: "https://from-config.example/npm/",
                scope: "@x",
            };
            expect(effectiveProdRegistryUrl(node)).toBe(
                "https://from-env.prod/npm/"
            );
        });
    });

    describe("effectiveNodeScope", () => {
        const saved = process.env.SCOPE;

        afterEach(() => {
            if (saved === undefined) {
                delete process.env.SCOPE;
            } else {
                process.env.SCOPE = saved;
            }
        });

        it("should_useScopeFromEnv_first", () => {
            process.env.SCOPE = "@acko";
            const node: NodePublishConfig = {
                registryUrl: "https://r.example/npm/",
                scope: "@ignored",
            };
            expect(effectiveNodeScope(node)).toBe("@acko");
        });
    });
});
