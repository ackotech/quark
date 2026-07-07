import { Logger } from "../ports/logger";
import { GitService } from "../ports/git";
import { GraphProvider } from "../ports/graph";
import {
    PlatformProdPublishAdapter,
    PackageIdentity,
} from "../ports/platform-prod-publish-adapter";
import { PackageMap } from "../ports/map";
import { TopoSorter } from "../domain/topological-sorting";
import { QuarkConfig } from "../ports/config";

interface ValidatedPackage {
    packageName: string;
    packageDir: string;
    adapter: PlatformProdPublishAdapter;
    identity: PackageIdentity;
}

export class ProdPublishApplication {
    constructor(
        private readonly logger: Logger,
        private readonly git: GitService,
        private readonly graphProvider: GraphProvider,
        private readonly adapters: PlatformProdPublishAdapter[],
        private readonly topoSorter: TopoSorter,
        private readonly quarkConfig: QuarkConfig
    ) {}

    async execute(targetTag?: string): Promise<void> {
        this.logger.info("Building dependency graph...");
        const graph = await this.graphProvider.build();

        this.logger.info("Resolving git tags...");
        const [previousTag, latestTag] = await this.git.getTags(targetTag);
        if (previousTag === null) {
            this.logger.info(
                `No older tag: using empty release map baseline → ${latestTag}`
            );
        } else {
            this.logger.info(`Comparing tags: ${previousTag} → ${latestTag}`);
        }

        const { changedPackages, oldMap, newMap } =
            await this.detectChangedPackages(previousTag, latestTag);

        const freezeFiltered = this.applyFreezePublishFilter(
            changedPackages,
            oldMap,
            newMap
        );

        if (freezeFiltered.length === 0) {
            this.logger.warn(
                changedPackages.length === 0
                    ? "No package changes detected for this release (map at latest tag vs baseline)."
                    : "No packages qualify for prod publish after freeze policy (same-version unfrozen map-only updates are skipped)."
            );
            return;
        }

        const ordered = this.topoSorter.sort(
            graph.adjacency,
            freezeFiltered
        );

        this.logger.info(`Changed packages: ${ordered.join(", ")}`);

        const validated = await this.validateAll(ordered, graph.metadata);
        await this.publishAll(validated);

        this.logger.success(
            `Published ${validated.length} package(s) to prod registry.`
        );
    }

    private async validateAll(
        changedPackages: string[],
        metadata: Record<string, { rootDir: string; platform: string }>
    ): Promise<ValidatedPackage[]> {
        const toPublish: ValidatedPackage[] = [];

        for (const pkgName of changedPackages) {
            const meta = metadata[pkgName];
            if (!meta) {
                this.logger.warn(
                    `Package "${pkgName}" not found in graph, skipping.`
                );
                continue;
            }

            const adapter = this.adapters.find((a) => a.supports(meta));
            if (!adapter) {
                this.logger.warn(
                    `No prod-publish adapter for platform "${meta.platform}", skipping ${pkgName}.`
                );
                continue;
            }

            const identity = await adapter.readPackageIdentity(meta.rootDir);
            const exists = await adapter.versionExistsInRegistry(
                identity.name,
                identity.version
            );

            if (exists) {
                throw new Error(
                    `Version ${identity.name}@${identity.version} already exists in prod registry. Aborting all publish operations.`
                );
            }

            toPublish.push({
                packageName: pkgName,
                packageDir: meta.rootDir,
                adapter,
                identity,
            });
        }

        return toPublish;
    }

    private async publishAll(packages: ValidatedPackage[]): Promise<void> {
        for (const { adapter, identity, packageDir } of packages) {
            this.logger.info(
                `Publishing ${identity.name}@${identity.version}...`
            );
            await adapter.publish(packageDir);
            this.logger.success(
                `Published ${identity.name}@${identity.version}`
            );
        }
    }

    /**
     * When {@link QuarkConfig.release.freeze} is enabled, skip **updated** packages that
     * stayed on the same `newVersion` while remaining unfrozen — those
     * are map-only churn (e.g. changelog) and are not registry-ready compared to frozen
     * artifacts. New packages and any version bump still publish.
     */
    private applyFreezePublishFilter(
        changed: string[],
        oldMap: PackageMap,
        newMap: PackageMap
    ): string[] {
        if (!this.quarkConfig.release.freeze) {
            return changed;
        }

        return changed.filter((key) => {
            const prev = oldMap[key];
            const next = newMap[key];
            if (!prev) {
                return true;
            }
            const prevVer = prev.newVersion ?? "";
            const nextVer = next.newVersion ?? "";
            if (prevVer !== nextVer) {
                return true;
            }
            if (next.frozen === true) {
                return true;
            }
            this.logger.warn(
                `Skipping prod publish for "${key}": release.freeze is enabled, version unchanged (${nextVer}), and package is not frozen (map-only update).`
            );
            return false;
        });
    }

    private async detectChangedPackages(
        previousTag: string | null,
        latestTag: string
    ): Promise<{
        changedPackages: string[];
        oldMap: PackageMap;
        newMap: PackageMap;
    }> {
        const oldMapRaw =
            previousTag === null
                ? "{}"
                : await this.git.readFileFromRef(
                      ".release/map.json",
                      previousTag
                  );
        const newMapRaw = await this.git.readFileFromRef(
            ".release/map.json",
            latestTag
        );

        const oldMap: PackageMap = JSON.parse(oldMapRaw);
        const newMap: PackageMap = JSON.parse(newMapRaw);

        const allKeys = new Set([
            ...Object.keys(oldMap),
            ...Object.keys(newMap),
        ]);

        const changed: string[] = [];

        for (const key of allKeys) {
            const isAdded = !(key in oldMap);
            const isUpdated =
                key in oldMap &&
                key in newMap &&
                JSON.stringify(oldMap[key]) !== JSON.stringify(newMap[key]);

            if (isAdded || isUpdated) {
                changed.push(key);
            }
        }

        return { changedPackages: changed, oldMap, newMap };
    }
}
