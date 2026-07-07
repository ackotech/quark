import chalk from "chalk";
import { existsSyncSafe, rmSyncSafe } from "@quark-hq/quark-security";
import { DEFAULT_DOTENV_KEYS } from "./constants";
import { logStep, logSuccess } from "./cli-output";
import { ensureCliEnvironment } from "./environment";
import * as Scaffold from "./scaffold";
import { resolveProjectRoot, workspaceRoot } from "./paths";
import { DirectoryAlreadyExistsError } from "../errors/directory-errors";

/**
 * Orchestrates the Quark project bootstrap flow.
 * Delegates to focused modules (environment checks, path helpers, scaffold steps).
 */
export class Init {
    constructor(private readonly projectName: string) { }

    async checkDependencies(): Promise<void> {
        await ensureCliEnvironment();
    }

    createNpmPackage(projectName: string): void {
        Scaffold.createNpmPackage(projectName);
    }

    initializePnpmWorkspace(projectDir: string): void {
        Scaffold.initializePnpmWorkspace(projectDir);
    }

    initializeGitRepository(projectDir: string): void {
        Scaffold.initializeGitRepository(projectDir);
    }

    writeGithubWorkflows(projectDir: string): void {
        Scaffold.writeGithubWorkflows(projectDir);
    }

    installDependencies(projectDir: string): void {
        Scaffold.installRootDependencies(projectDir);
    }

    addRootScripts(projectDir: string): void {
        Scaffold.addRootScripts(projectDir);
    }

    createButtonComponent(projectDir: string): void {
        Scaffold.createButtonComponent(projectDir);
    }

    createStorybookApplication(projectDir: string): void {
        Scaffold.createStorybookApplication(projectDir);
    }

    createDotenvFile(projectDir: string, keys: string[]): void {
        Scaffold.createDotenvFile(projectDir, keys);
    }

    createDockerfile(projectDir: string): void {
        Scaffold.createDockerfile(projectDir);
    }

    createGitignore(projectPath: string): void {
        Scaffold.createStandaloneGitignore(projectPath);
    }

    async main(): Promise<void> {
        const { projectName } = this;
        let projectDir: string | null = null;
        let createdByThisRun = false;

        console.log(
            chalk.bold(`\nQuark — new project: ${chalk.cyan(projectName)}\n`)
        );

        await this.checkDependencies();

        try {
            this.createNpmPackage(projectName);
            createdByThisRun = true;
            projectDir = resolveProjectRoot(projectName);
            logStep("pnpm workspace and workspace files…");
            this.initializePnpmWorkspace(projectName);

            logStep("Git repository…");
            this.initializeGitRepository(projectName);

            this.writeGithubWorkflows(projectName);

            this.installDependencies(projectName);

            logStep("Root package.json scripts…");
            this.addRootScripts(projectName);

            this.createButtonComponent(projectName);
            this.createStorybookApplication(projectName);

            logStep(".env placeholder…");
            this.createDotenvFile(projectName, [...DEFAULT_DOTENV_KEYS]);

            logStep("Dockerfile…");
            this.createDockerfile(projectName);

            logSuccess(`Project "${projectName}" is ready`);
            console.log(
                chalk.dim(
                    `  Next: cd ${projectName} && pnpm dev   (or pnpm storybook)\n`
                )
            );
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to scaffold project";
            console.error(chalk.red(`❌ ${message}`));

            if (
                !(error instanceof DirectoryAlreadyExistsError) &&
                createdByThisRun &&
                projectDir !== null &&
                existsSyncSafe(workspaceRoot(), projectDir)
            ) {
                try {
                    console.log(
                        chalk.yellow(
                            `Cleanup: removing "${projectName}" after failure...`
                        )
                    );
                    rmSyncSafe(workspaceRoot(), projectDir, {
                        recursive: true,
                        force: true,
                    });
                } catch (cleanupError) {
                    const cleanupMessage =
                        cleanupError instanceof Error
                            ? cleanupError.message
                            : "Unknown cleanup error";
                    console.error(
                        chalk.red(
                            `❌ Failed to clean up "${projectName}": ${cleanupMessage}`
                        )
                    );
                }
            }

            process.exit(1);
        }
    }
}
