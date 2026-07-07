import {
    assertSpawnOk,
    assertValidNpmPackageName,
    existsSyncSafe,
    mkdirSyncSafe,
    readFileSyncSafe,
    spawnSyncSafe,
    writeFileSyncSafe,
} from "@quark-hq/quark-security";
import {
    DEFAULT_DOTENV_KEYS,
    DEFAULT_NPMRC,
    DOCKERFILE_TEMPLATE,
    PACKAGE_MANAGER_PIN,
    PNPM_WORKSPACE_YAML,
    ROOT_DEV_DEPENDENCIES,
    ROOT_PACKAGE_SCRIPTS,
    ROOT_PROD_DEPENDENCIES,
    STANDALONE_GITIGNORE_LINES,
    WORKSPACE_GITIGNORE_LINES,
} from "./constants";
import { getQuarkScriptsDependencySpecifier } from "./quark-scripts-spec";
import { resolveProjectRoot, safePathInProject, workspaceRoot } from "./paths";
import { PNPM_SILENT_PREFIX, logStep, logSuccess } from "./cli-output";
import { scaffoldViteReactPackageFiles } from "../utils/create-new-package";
import { getGithubWorkflowFiles } from "../templates/github";
import { DirectoryAlreadyExistsError } from "../errors/directory-errors";
import chalk from "chalk";

function pnpmArgs(...rest: string[]): string[] {
    return [...PNPM_SILENT_PREFIX, ...rest];
}

function toErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

export function createNpmPackage(projectName: string): void {
    try {
        assertValidNpmPackageName(projectName, "project name");
    } catch (e) {
        const msg = toErrorMessage(e);
        throw new Error(`Invalid project name "${projectName}": ${msg}`);
    }

    const projectDir = resolveProjectRoot(projectName);
    const ws = workspaceRoot();
    if (existsSyncSafe(ws, projectDir)) {
        throw new DirectoryAlreadyExistsError(projectName);
    }

    try {
        logStep(`Creating project "${projectName}"…`);
        mkdirSyncSafe(ws, projectDir);
        assertSpawnOk(
            spawnSyncSafe("npm", ["init", "-y"], {
                cwd: projectDir,
                stdio: "ignore",
            }),
            "npm init"
        );

        const packageJsonPath = safePathInProject(projectDir, "package.json");
        const pkg = JSON.parse(readFileSyncSafe(ws, packageJsonPath));
        pkg.name = projectName;
        writeFileSyncSafe(ws, packageJsonPath, JSON.stringify(pkg, null, 2));

        logSuccess(`Project "${projectName}" created`);
    } catch (err: unknown) {
        const message = toErrorMessage(err);
        throw new Error(`Failed to create package: ${message}`);
    }
}

export function initializePnpmWorkspace(projectSegment: string): void {
    try {
        const projectRoot = resolveProjectRoot(projectSegment);
        const ws = workspaceRoot();

        writeFileSyncSafe(
            ws,
            safePathInProject(projectRoot, "pnpm-workspace.yaml"),
            PNPM_WORKSPACE_YAML
        );

        const packageJsonPath = safePathInProject(projectRoot, "package.json");
        if (existsSyncSafe(ws, packageJsonPath)) {
            const pkg = JSON.parse(readFileSyncSafe(ws, packageJsonPath));
            pkg.private = true;
            pkg.packageManager = PACKAGE_MANAGER_PIN;
            writeFileSyncSafe(
                ws,
                packageJsonPath,
                JSON.stringify(pkg, null, 2)
            );
        }

        writeFileSyncSafe(
            ws,
            safePathInProject(projectRoot, ".npmrc"),
            DEFAULT_NPMRC,
            "utf8"
        );

        const gitignoreContent =
            [...WORKSPACE_GITIGNORE_LINES].join("\n") + "\n";
        writeFileSyncSafe(
            ws,
            safePathInProject(projectRoot, ".gitignore"),
            gitignoreContent,
            "utf8"
        );

        const releaseDir = safePathInProject(projectRoot, ".release");
        if (!existsSyncSafe(ws, releaseDir)) {
            mkdirSyncSafe(ws, releaseDir);
        }

        logSuccess(`pnpm workspace ready (${projectRoot})`);
    } catch (err: unknown) {
        const message = toErrorMessage(err);
        throw new Error(`Failed to initialize pnpm workspace: ${message}`);
    }
}

export function initializeGitRepository(projectSegment: string): void {
    const projectRoot = resolveProjectRoot(projectSegment);
    try {
        assertSpawnOk(
            spawnSyncSafe("git", ["init"], {
                cwd: projectRoot,
                stdio: "ignore",
            }),
            "git init"
        );
        logSuccess("Git repository initialized");
    } catch (err: unknown) {
        const message = toErrorMessage(err);
        throw new Error(`Failed to initialize Git repository: ${message}`);
    }
}

export function writeGithubWorkflows(projectSegment: string): void {
    const projectRoot = resolveProjectRoot(projectSegment);
    const ws = workspaceRoot();
    const workflowsDir = safePathInProject(
        projectRoot,
        ".github",
        "workflows"
    );

    try {
        logStep("GitHub Actions workflows…");
        mkdirSyncSafe(ws, workflowsDir, { recursive: true });
        for (const { filename, content } of getGithubWorkflowFiles()) {
            const filePath = safePathInProject(workflowsDir, filename);
            writeFileSyncSafe(ws, filePath, content + "\n", "utf8");
        }
        logSuccess("GitHub Actions workflows added");
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
            chalk.red(`❌ Failed to write GitHub workflows: ${message}`)
        );
        process.exit(1);
    }
}

export function installRootDependencies(projectSegment: string): void {
    const projectRoot = resolveProjectRoot(projectSegment);
    try {
        logStep("Installing workspace dependencies…");
        if (ROOT_PROD_DEPENDENCIES.length > 0) {
            assertSpawnOk(
                spawnSyncSafe(
                    "pnpm",
                    pnpmArgs("add", "-w", ...ROOT_PROD_DEPENDENCIES),
                    { cwd: projectRoot, stdio: "ignore" }
                ),
                "pnpm add"
            );
        }
        const quarkScriptsSpec = getQuarkScriptsDependencySpecifier();
        const devDepSpecs = [
            ...ROOT_DEV_DEPENDENCIES,
            quarkScriptsSpec,
        ];
        if (devDepSpecs.length > 0) {
            assertSpawnOk(
                spawnSyncSafe(
                    "pnpm",
                    pnpmArgs("add", "-w", "-D", ...devDepSpecs),
                    { cwd: projectRoot, stdio: "ignore" }
                ),
                "pnpm add -D"
            );
        }
        logSuccess("Workspace dependencies installed");
    } catch (err: unknown) {
        const message = toErrorMessage(err);
        throw new Error(`Failed to install dependencies: ${message}`);
    }
}

export function addRootScripts(projectSegment: string): void {
    const projectRoot = resolveProjectRoot(projectSegment);
    const packageJsonPath = safePathInProject(projectRoot, "package.json");
    const ws = workspaceRoot();

    try {
        if (!existsSyncSafe(ws, projectRoot)) {
            throw new Error(`Directory "${projectSegment}" does not exist.`);
        }
        if (!existsSyncSafe(ws, packageJsonPath)) {
            throw new Error(`Cannot find package.json at ${packageJsonPath}`);
        }
        const pkg = JSON.parse(readFileSyncSafe(ws, packageJsonPath));
        pkg.scripts = { ...ROOT_PACKAGE_SCRIPTS };
        writeFileSyncSafe(
            ws,
            packageJsonPath,
            JSON.stringify(pkg, null, 2)
        );
        logSuccess("Root package scripts added");
    } catch (err: unknown) {
        const message = toErrorMessage(err);
        throw new Error(`Failed to add scripts to package.json: ${message}`);
    }
}

export function createButtonComponent(projectSegment: string): void {
    const projectRoot = resolveProjectRoot(projectSegment);
    const buttonPackageDir = safePathInProject(
        projectRoot,
        "packages",
        "button"
    );

    try {
        logStep("Scaffolding packages/button (Vite + React)…");
        mkdirSyncSafe(workspaceRoot(), buttonPackageDir, { recursive: true });

        const buttonPackageName = "button";

        assertSpawnOk(
            spawnSyncSafe("npm", ["init", "-y"], {
                cwd: buttonPackageDir,
                stdio: "ignore",
            }),
            "npm init"
        );

        scaffoldViteReactPackageFiles(buttonPackageDir, buttonPackageName);

        assertSpawnOk(
            spawnSyncSafe("pnpm", pnpmArgs("install"), {
                cwd: buttonPackageDir,
                stdio: "ignore",
            }),
            "pnpm install"
        );

        assertSpawnOk(
            spawnSyncSafe(
                "pnpm",
                pnpmArgs("add", "-D", "@types/react", "@types/react-dom"),
                {
                    cwd: buttonPackageDir,
                    stdio: "ignore",
                }
            ),
            "pnpm add @types/react"
        );

        const { buttonTemplate } = require("../templates/button/button");
        const { buttonIndexTemplate } = require("../templates/button");

        writeFileSyncSafe(
            workspaceRoot(),
            safePathInProject(buttonPackageDir, "src", "button.tsx"),
            buttonTemplate,
            "utf8"
        );
        writeFileSyncSafe(
            workspaceRoot(),
            safePathInProject(buttonPackageDir, "src", "index.ts"),
            buttonIndexTemplate,
            "utf8"
        );

        logSuccess(`Button package ready (${buttonPackageDir})`);
    } catch (err: unknown) {
        const message = toErrorMessage(err);
        throw new Error(`Failed to create button component: ${message}`);
    }
}

export function createStorybookApplication(projectSegment: string): void {
    const projectRoot = resolveProjectRoot(projectSegment);
    const storybookApplicationDir = safePathInProject(
        projectRoot,
        "apps",
        "storybook"
    );

    try {
        logStep("Scaffolding apps/storybook…");
        mkdirSyncSafe(workspaceRoot(), storybookApplicationDir, {
            recursive: true,
        });

        assertSpawnOk(
            spawnSyncSafe("npm", ["init", "-y"], {
                cwd: storybookApplicationDir,
                stdio: "ignore",
            }),
            "npm init"
        );

        assertSpawnOk(
            spawnSyncSafe(
                "pnpm",
                pnpmArgs("add", "react@18.3.0", "react-dom@18.3.0"),
                {
                    cwd: storybookApplicationDir,
                    stdio: "ignore",
                }
            ),
            "pnpm add storybook deps"
        );

        const storybookInitEnv: NodeJS.ProcessEnv = {
            ...process.env,
            CI: "true",
            STORYBOOK_DISABLE_TELEMETRY: "1",
        };

        assertSpawnOk(
            spawnSyncSafe(
                "pnpm",
                pnpmArgs(
                    "dlx",
                    "storybook@8.4.5",
                    "init",
                    "--yes",
                    "--type",
                    "react",
                    "--builder",
                    "vite",
                    "--skip-install"
                ),
                {
                    cwd: storybookApplicationDir,
                    stdio: "ignore",
                    env: storybookInitEnv,
                } as unknown as Parameters<typeof spawnSyncSafe>[2]
            ),
            "storybook init"
        );

        logSuccess(
            `Storybook ready (${storybookApplicationDir}) — run pnpm storybook from the repo root`
        );

        const storiesDir = safePathInProject(storybookApplicationDir, "stories");
        const { buttonStoriesTemplate } = require("../templates/button/button.stories");
        writeFileSyncSafe(
            workspaceRoot(),
            safePathInProject(storiesDir, "Buttoa.stories.tsx"),
            buttonStoriesTemplate,
            "utf8"
        );

        logSuccess("Button stories added");
    } catch (err: unknown) {
        const message = toErrorMessage(err);
        throw new Error(`Failed to create Storybook application: ${message}`);
    }
}

export function createDotenvFile(
    projectSegment: string,
    keys: readonly string[] = DEFAULT_DOTENV_KEYS
): void {
    const projectRoot = resolveProjectRoot(projectSegment);
    const dotenvPath = safePathInProject(projectRoot, ".env");
    const dotenvContent = keys.map((key) => `${key} = ""`).join("\n") + "\n";

    try {
        writeFileSyncSafe(workspaceRoot(), dotenvPath, dotenvContent, "utf8");
        logSuccess(`.env created (${dotenvPath})`);
    } catch (err: unknown) {
        const message = toErrorMessage(err);
        throw new Error(`Failed to create .env file: ${message}`);
    }
}

export function createDockerfile(projectSegment: string): void {
    const projectRoot = resolveProjectRoot(projectSegment);
    const dockerfilePath = safePathInProject(projectRoot, "Dockerfile");

    try {
        writeFileSyncSafe(
            workspaceRoot(),
            dockerfilePath,
            DOCKERFILE_TEMPLATE + "\n",
            "utf8"
        );
        logSuccess(`Dockerfile created (${dockerfilePath})`);
    } catch (err: unknown) {
        const message = toErrorMessage(err);
        throw new Error(`Failed to create Dockerfile: ${message}`);
    }
}

export function createStandaloneGitignore(projectSegment: string): void {
    const projectRoot = resolveProjectRoot(projectSegment);
    const gitignoreContent =
        [...STANDALONE_GITIGNORE_LINES].join("\n") + "\n";
    const gitignorePath = safePathInProject(projectRoot, ".gitignore");

    try {
        writeFileSyncSafe(
            workspaceRoot(),
            gitignorePath,
            gitignoreContent,
            "utf8"
        );
        console.log(`.gitignore created at ${gitignorePath}`);
    } catch (err: unknown) {
        const message = toErrorMessage(err);
        throw new Error(`Failed to create .gitignore: ${message}`);
    }
}
