import { PackageMetadata } from "../../domain/graph";
import {
    PlatformProdPublishAdapter,
    PackageIdentity,
} from "../../ports/platform-prod-publish-adapter";
import { QuarkConfig } from "../../ports/config";
import { Logger } from "../../ports/logger";

/**
 * Boilerplate adapter for Maven prod publishing.
 *
 * Extend this class with real implementation when Maven prod-publish
 * support is needed. The key extension points are:
 *
 *   - readPackageIdentity()  – parse pom.xml for artifactId + version
 *   - versionExistsInRegistry() – check the Maven repo for duplicates
 *   - publish() – run `mvn deploy` against the prod repository
 *
 * Configure via `publish.maven` in quark-config.json:
 *   {
 *     "publish": {
 *       "maven": {
 *         "repositoryUrl": "https://your-nexus/repository/releases/",
 *         "prodRepositoryUrl": "https://your-nexus/repository/releases/",
 *         "repositoryId": "releases"
 *       }
 *     }
 *   }
 *
 * If only `repositoryUrl` is set, it is used for both dev and prod.
 */
export class MavenProdPublishAdapter implements PlatformProdPublishAdapter {
    constructor(
        protected readonly quarkConfig: QuarkConfig,
        protected readonly logger: Logger
    ) {}

    supports(meta: PackageMetadata): boolean {
        return meta.platform === "maven";
    }

    async readPackageIdentity(_packageDir: string): Promise<PackageIdentity> {
        throw new Error(
            "Maven prod-publish is not implemented yet. " +
                "Override readPackageIdentity() in a concrete subclass."
        );
    }

    async versionExistsInRegistry(
        _packageName: string,
        _version: string
    ): Promise<boolean> {
        throw new Error(
            "Maven prod-publish is not implemented yet. " +
                "Override versionExistsInRegistry() in a concrete subclass."
        );
    }

    async publish(_packageDir: string): Promise<void> {
        throw new Error(
            "Maven prod-publish is not implemented yet. " +
                "Override publish() in a concrete subclass."
        );
    }
}
