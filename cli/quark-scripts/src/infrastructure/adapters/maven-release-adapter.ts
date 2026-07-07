import chalk from "chalk";
import { Graph, PackageMetadata } from "../../domain/graph";
import { PackageMap } from "../../ports/map";
import { PromptResult } from "../../ports/prompts";
import { DevPublishContext } from "../../ports/platform-dev-publish-adapter";
import { GraphProvider } from "../../ports/graph";
import { QuarkConfig } from "../../ports/config";
import { Logger } from "../../ports/logger";
import { BaseReleaseAdapter } from "./base-release-adapter";

/**
 * Boilerplate adapter for Maven release and dev-publish.
 *
 * Extend this class with real implementation when Maven support
 * is needed. The key extension points are:
 *
 *   Release:
 *   - writePackageFiles()  – update pom.xml with new version / frozen deps
 *
 *   Dev-publish:
 *   - getCurrentVersion()  – read current version from pom.xml
 *   - publish()            – build + deploy to the dev Maven repository
 *
 * Configure via `publish.maven` in quark-config.json:
 *   {
 *     "publish": {
 *       "maven": {
 *         "repositoryUrl": "https://your-nexus/repository/releases/",
 *         "devRepositoryUrl": "https://your-nexus/repository/snapshots/",
 *         "repositoryId": "releases"
 *       }
 *     }
 *   }
 *
 * If only `repositoryUrl` is set, it is used for both dev and prod.
 */
export class MavenReleaseAdapter extends BaseReleaseAdapter {
    constructor(
        graphProvider: GraphProvider,
        quarkConfig: QuarkConfig,
        logger: Logger
    ) {
        super(graphProvider, quarkConfig, logger);
    }

    supports(meta: PackageMetadata): boolean {
        return meta.platform === "maven";
    }

    protected getPlatformLabel(pkg: string): string {
        return chalk.bold.magenta(`☕  Releasing (Maven): ${pkg}`);
    }

    protected async writePackageFiles(
        _pkg: string,
        _prompt: PromptResult,
        _mapJsonObject: PackageMap,
        _graph: Graph
    ): Promise<void> {
        throw new Error(
            "Maven release is not implemented yet. " +
                "Override writePackageFiles() in a concrete subclass."
        );
    }

    async getCurrentVersion(_packageDir: string): Promise<string> {
        throw new Error(
            "Maven dev-publish is not implemented yet. " +
                "Override getCurrentVersion() in a concrete subclass."
        );
    }

    async publish(
        _ctx: DevPublishContext,
        _alphaVersion: string
    ): Promise<void> {
        throw new Error(
            "Maven dev-publish is not implemented yet. " +
                "Override publish() in a concrete subclass."
        );
    }
}
