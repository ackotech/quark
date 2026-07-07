import chalk from "chalk";
import prompts from "prompts";
import * as semver from "semver";
import { Logger } from "../ports/logger";
import { GitService } from "../ports/git";
import { GraphProvider } from "../ports/graph";
import { PlatformDevPublishAdapter } from "../ports/platform-dev-publish-adapter";
import { BaseApplication } from "./base-application";

export class PublishDevApplication extends BaseApplication {
    constructor(
        logger: Logger,
        git: GitService,
        graphProvider: GraphProvider,
        private readonly adapters: PlatformDevPublishAdapter[],
        masterBranch: string = "main"
    ) {
        super(logger, git, graphProvider, masterBranch);
    }

    async execute(): Promise<void> {
        this.logger.info("Performing repository checks...");
        const repoRoot = await this.ensureRepositoryHealthy();

        this.logger.info("Building dependency graph...");
        const graph = await this.buildGraph();

        const changedFiles = await this.getChangedAbsolutePaths(repoRoot);
        const changedPackages = this.mapFilesToPackages(
            changedFiles,
            graph.metadata
        );

        if (changedPackages.size === 0) {
            this.logger.warn(
                `No packages have changed since ${this.masterBranch}. Nothing to publish.`
            );
            return;
        }

        this.logger.info(
            `Changed packages: ${[...changedPackages].join(", ")}`
        );

        const packageName = await this.promptPackageName(changedPackages);

        const meta = graph.metadata[packageName];
        const adapter = this.adapters.find((a) => a.supports(meta));
        if (!adapter) {
            throw new Error(
                `No dev-publish adapter for platform "${meta.platform}"`
            );
        }

        const currentVersion = await adapter.getCurrentVersion(meta.rootDir);
        const alphaVersion = this.generateAlphaVersion(currentVersion);

        this.logger.info(
            `Version: ${currentVersion} → ${chalk.bold(alphaVersion)}`
        );

        await adapter.publish(
            { packageName, packageDir: meta.rootDir, repoRoot },
            alphaVersion
        );
    }

    private async promptPackageName(
        changedPackages: Set<string>
    ): Promise<string> {
        const packages = [...changedPackages].sort();

        const response = await prompts(
            {
                type: "autocomplete",
                name: "packageName",
                message: chalk.yellow(
                    "Select the changed package to publish as alpha:"
                ),
                choices: packages.map((pkg) => ({
                    title: pkg,
                    value: pkg,
                })),
                suggest: async (input: string, choices: any[]) =>
                    choices.filter((c: any) =>
                        c.title
                            .toLowerCase()
                            .includes(input.toLowerCase())
                    ),
            },
            {
                onCancel: () => {
                    throw new Error("Publish cancelled by user");
                },
            }
        );

        if (!response.packageName) {
            throw new Error("No package name provided");
        }

        return response.packageName;
    }

    private generateAlphaVersion(currentVersion: string): string {
        const parsed = semver.parse(currentVersion);
        if (!parsed) {
            throw new Error(
                `Invalid semver version: ${currentVersion}`
            );
        }

        const base = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
        return `${base}-alpha.${Date.now()}`;
    }
}
