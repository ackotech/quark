import { resolve } from "path";
import { Logger } from "../ports/logger";
import { GitService } from "../ports/git";
import { GraphProvider } from "../ports/graph";
import { Graph, PackageMetadataMap } from "../domain/graph";

/**
 * Shared infrastructure for any command that operates on the monorepo graph:
 *   - repository health checks
 *   - dependency graph construction
 *   - changed-file detection and package ownership resolution
 */
export abstract class BaseApplication {
    constructor(
        protected readonly logger: Logger,
        protected readonly git: GitService,
        protected readonly graphProvider: GraphProvider,
        protected readonly masterBranch: string
    ) {}

    protected async ensureRepositoryHealthy(): Promise<string> {
        const repoRoot = await this.git.getRepositoryRoot();
        this.logger.info(`Repo root: ${repoRoot}`);

        const currentBranch = await this.git.getCurrentBranch();
        this.logger.info(`Current branch: ${currentBranch}`);

        await this.git.fetch(this.masterBranch);

        const behind = await this.git.commitsBehind(this.masterBranch);
        if (behind > 0) {
            throw new Error(
                `Branch is ${behind} commits behind origin/${this.masterBranch}`
            );
        }

        return repoRoot;
    }

    protected async buildGraph(): Promise<Graph> {
        const graph = await this.graphProvider.build();

        if (!graph || Object.keys(graph.adjacency).length === 0) {
            throw new Error("Dependency graph is empty");
        }

        return graph;
    }

    protected async getChangedAbsolutePaths(
        repoRoot: string
    ): Promise<string[]> {
        const relativeFiles = await this.git.getChangedFiles(this.masterBranch);
        return relativeFiles.map((f) => resolve(repoRoot, f));
    }

    protected isPackageAffected(
        packageDir: string,
        changedFiles: string[]
    ): boolean {
        return changedFiles.some((file) =>
            file.startsWith(packageDir + "/")
        );
    }

    protected mapFilesToPackages(
        changedFiles: string[],
        metadata: PackageMetadataMap
    ): Set<string> {
        const changed = new Set<string>();

        for (const file of changedFiles) {
            const owner = this.findOwningPackage(file, metadata);
            if (owner !== null) {
                changed.add(owner);
            }
        }

        return changed;
    }

    protected findOwningPackage(
        file: string,
        metadata: PackageMetadataMap
    ): string | null {
        let bestMatch: { name: string; rootDir: string } | null = null;

        for (const [name, { rootDir }] of Object.entries(metadata)) {
            if (!file.startsWith(rootDir + "/")) continue;

            if (
                bestMatch === null ||
                rootDir.length > bestMatch.rootDir.length
            ) {
                bestMatch = { name, rootDir };
            }
        }

        return bestMatch?.name ?? null;
    }
}
