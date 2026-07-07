import { Command } from "commander";
import { CliCommand } from "./cliCommand";

import { PublishDevCommand } from "./commands/publish-dev-commands";
import { ReleaseCommand } from "./commands/release-commands";
import { ProdPublishCommand } from "./commands/prod-publish-commands";
import { UnfreezeCommand } from "./commands/unfreeze-commands";
import { PublishDevApplication } from "../app/publish-dev-application";
import { ReleaseApplication } from "../app/release-application";
import { ProdPublishApplication } from "../app/prod-publish-application";
import { UnfreezeApplication } from "../app/unfreeze-application";

import { ConsoleLogger } from "../infrastructure/logging/consoleLogger";
import { NodeProcessRunner } from "../infrastructure/process/nodeProcessRunner";
import { NodeGitService } from "../infrastructure/git/gitService";
import { NxGraphProvider } from "../infrastructure/graph/nxGraphProvide";
import { NodeReleaseAdapter } from "../infrastructure/adapters/node-release-adapter";
import { MavenReleaseAdapter } from "../infrastructure/adapters/maven-release-adapter";
import { NodeProdPublishAdapter } from "../infrastructure/adapters/node-prod-publish-adapter";
import { MavenProdPublishAdapter } from "../infrastructure/adapters/maven-prod-publish-adapter";
import { TopoSorter } from "../domain/topological-sorting";
import { QuarkConfigProvider } from "../infrastructure/config/quarkConfigProvider";
import { GitReleaseMapStore } from "../infrastructure/release/git-release-map-store";

export class CliContainer {
    static create(): CliContainer {
        const logger = new ConsoleLogger();
        const processRunner = new NodeProcessRunner();
        const gitService = new NodeGitService();
        const graphProvider = new NxGraphProvider();
        const configProvider = new QuarkConfigProvider();
        const config = configProvider.getConfig();
        const { masterBranch } = config.release;

        // ── Platform adapters (shared across release + dev-publish) ────
        const nodeReleaseAdapter = new NodeReleaseAdapter(
            graphProvider,
            config,
            logger
        );
        const releaseAdapters = [
            nodeReleaseAdapter,
            new MavenReleaseAdapter(graphProvider, config, logger),
        ];

        // ── Unfreeze ───────────────────────────────────────────────────
        const releaseMapStore = new GitReleaseMapStore(gitService);
        const unfreezeApp = new UnfreezeApplication(
            graphProvider,
            releaseMapStore,
            nodeReleaseAdapter,
            logger,
            masterBranch
        );

        // ── Release ────────────────────────────────────────────────────
        const topoSorter = new TopoSorter();
        const releaseApp = new ReleaseApplication(
            logger,
            gitService,
            graphProvider,
            releaseAdapters,
            topoSorter,
            releaseMapStore,
            masterBranch
        );

        // ── Dev Publish (same adapters) ────────────────────────────────
        const publishDevApp = new PublishDevApplication(
            logger,
            gitService,
            graphProvider,
            releaseAdapters,
            masterBranch
        );

        // ── Prod Publish ────────────────────────────────────────────────
        const prodPublishAdapters = [
            new NodeProdPublishAdapter(config, logger),
            new MavenProdPublishAdapter(config, logger),
        ];
        const prodPublishApp = new ProdPublishApplication(
            logger,
            gitService,
            graphProvider,
            prodPublishAdapters,
            topoSorter,
            config
        );

        // ── Commands ───────────────────────────────────────────────────
        const commands: CliCommand[] = [
            new PublishDevCommand(publishDevApp),
            new ReleaseCommand(releaseApp),
            new UnfreezeCommand(unfreezeApp),
            new ProdPublishCommand(prodPublishApp),
        ];

        return new CliContainer(commands);
    }

    constructor(private readonly commands: CliCommand[]) {}

    register(program: Command): void {
        this.commands.forEach((command) => {
            command.register(program);
        });
    }
}
