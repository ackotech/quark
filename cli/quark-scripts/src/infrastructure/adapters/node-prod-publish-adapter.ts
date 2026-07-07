import path from "path";
import fs from "fs/promises";
import semver from "semver";
import {
    assertPathInsideRoot,
    assertSpawnOk,
    assertValidNpmPackageName,
    spawnSyncSafe,
    stripUrlCredentials,
} from "@quark-hq/quark-security";
import { PackageMetadata } from "../../domain/graph";
import {
    PlatformProdPublishAdapter,
    PackageIdentity,
} from "../../ports/platform-prod-publish-adapter";
import { QuarkConfig } from "../../ports/config";
import { Logger } from "../../ports/logger";
import {
    effectiveDevRegistryUrl,
    effectiveProdRegistryUrl,
} from "../config/nodeRegistryEnv";

export class NodeProdPublishAdapter implements PlatformProdPublishAdapter {
    constructor(
        private readonly quarkConfig: QuarkConfig,
        private readonly logger: Logger
    ) {}

    supports(meta: PackageMetadata): boolean {
        return meta.platform === "node";
    }

    async readPackageIdentity(packageDir: string): Promise<PackageIdentity> {
        const safeDir = assertPathInsideRoot(process.cwd(), packageDir);
        const pkgJsonPath = path.join(safeDir, "package.json");
        const raw = await fs.readFile(pkgJsonPath, "utf8");
        const pkgJson = JSON.parse(raw);
        return { name: pkgJson.name, version: pkgJson.version };
    }

    async versionExistsInRegistry(
        packageName: string,
        version: string
    ): Promise<boolean> {
        assertValidNpmPackageName(packageName, "package name");
        if (!semver.valid(version)) {
            throw new Error(`Invalid semver version: ${version}`);
        }

        const registries = this.getUniqueRegistryUrls();

        for (const url of registries) {
            const r = spawnSyncSafe(
                "npm",
                [
                    "view",
                    `${packageName}@${version}`,
                    "version",
                    "--registry",
                    url,
                ],
                { stdio: "pipe" }
            );
            if (r.status === 0 && !r.error) {
                this.logger.warn(
                    `${packageName}@${version} already exists in registry: ${stripUrlCredentials(
                        url
                    )}`
                );
                return true;
            }
        }

        return false;
    }

    /**
     * Publishes to registries in order: dev (or fallback {@link NodePublishConfig.registryUrl}),
     * then prod — matching the legacy prod-publish flow. Duplicate URLs are skipped so the same
     * registry is not published twice.
     */
    async publish(packageDir: string): Promise<void> {
        const safeDir = assertPathInsideRoot(process.cwd(), packageDir);
        const registries = this.getPublishRegistryUrlsInOrder();

        for (const registryUrl of registries) {
            this.logger.info(
                `Publishing to registry: ${stripUrlCredentials(registryUrl)}`
            );
            assertSpawnOk(
                spawnSyncSafe(
                    "pnpm",
                    [
                        "publish",
                        "--registry",
                        registryUrl,
                        "--no-git-checks",
                    ],
                    {
                        cwd: safeDir,
                        stdio: "inherit",
                    }
                ),
                `pnpm publish (${stripUrlCredentials(registryUrl)})`
            );
        }
    }

    /**
     * Ordered list for publish: dev URL first, then prod URL. Values come from
     * `.env` (`DEV_REGISTRY_URL`, `PROD_REGISTRY_URL`) when set, else quark-config
     * {@link NodePublishConfig.devRegistryUrl}, {@link NodePublishConfig.prodRegistryUrl},
     * {@link NodePublishConfig.registryUrl}.
     */
    private getPublishRegistryUrlsInOrder(): string[] {
        const nodeConfig = this.quarkConfig.publish?.node;
        const devUrl = effectiveDevRegistryUrl(nodeConfig);
        const prodUrl = effectiveProdRegistryUrl(nodeConfig);

        const ordered: string[] = [];
        if (devUrl) {
            ordered.push(devUrl);
        }
        if (prodUrl && prodUrl !== devUrl) {
            ordered.push(prodUrl);
        }

        if (ordered.length === 0) {
            throw new Error(
                "No registry URLs configured. Set DEV_REGISTRY_URL / PROD_REGISTRY_URL in .env or publish.node.registryUrl (and optional dev/prod URLs) in quark-config.json"
            );
        }

        return ordered;
    }

    /**
     * Returns deduplicated list of all registry URLs that need checking.
     * Collects the effective dev URL and effective prod URL, then deduplicates.
     * If both flows resolve to the same URL, only one check is performed.
     */
    private getUniqueRegistryUrls(): string[] {
        const nodeConfig = this.quarkConfig.publish?.node;
        const effectiveDevUrl = effectiveDevRegistryUrl(nodeConfig);
        const effectiveProdUrl = effectiveProdRegistryUrl(nodeConfig);

        const urls = new Set<string>();
        if (effectiveDevUrl) urls.add(effectiveDevUrl);
        if (effectiveProdUrl) urls.add(effectiveProdUrl);

        if (urls.size === 0) {
            throw new Error(
                "No registry URLs configured. Set DEV_REGISTRY_URL / PROD_REGISTRY_URL in .env or publish.node.registryUrl in quark-config.json"
            );
        }

        return [...urls];
    }
}
