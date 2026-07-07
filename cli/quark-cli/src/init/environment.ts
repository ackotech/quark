import chalk from "chalk";
import { assertSpawnOk, spawnSyncSafe } from "@quark-hq/quark-security";
import { ALLOWED_EXTERNAL_COMMANDS, MIN_NODE_MAJOR } from "./constants";
import { logStep, logSuccess } from "./cli-output";

function exitWithError(message: string): never {
    console.error(message);
    process.exit(1);
}

function assertNodeVersion(): void {
    const nodeVersion = process.version.replace(/^v/, "");
    const majorVersion = parseInt(nodeVersion.split(".")[0], 10);
    if (Number.isNaN(majorVersion) || majorVersion < MIN_NODE_MAJOR) {
        exitWithError(
            `❌ Node.js version ${MIN_NODE_MAJOR} or above is required.`
        );
    }
}

function isCommandOnPath(cmd: string): boolean {
    if (!ALLOWED_EXTERNAL_COMMANDS.has(cmd)) {
        return false;
    }
    try {
        const r = spawnSyncSafe(cmd, ["--version"], { stdio: "ignore" });
        return r.status === 0 && !r.error;
    } catch {
        return false;
    }
}

function installGlobalPackage(pkg: "pnpm" | "yalc"): void {
    try {
        logStep(`Installing ${pkg} globally (one-time)…`);
        assertSpawnOk(
            spawnSyncSafe("npm", ["install", "-g", "--loglevel", "error", pkg], {
                stdio: "ignore",
            }),
            "npm install -g"
        );
        logSuccess(`${pkg} installed globally`);
    } catch {
        console.error(
            chalk.red(
                `❌ Failed to install ${pkg} globally. Please install it manually.`
            )
        );
        process.exit(1);
    }
}

/**
 * Ensures Node version and required global CLIs (pnpm, yalc) are available.
 */
export async function ensureCliEnvironment(): Promise<void> {
    assertNodeVersion();

    logStep("Checking pnpm and yalc…");

    if (!isCommandOnPath("pnpm")) {
        installGlobalPackage("pnpm");
    }
    if (!isCommandOnPath("yalc")) {
        installGlobalPackage("yalc");
    }

    logSuccess("pnpm and yalc are available");
}
