import path from "path";
import { spawnSync, SpawnSyncReturns } from "child_process";

/**
 * Validates the executable passed to spawn (no shell): basename-only CLIs or paths without ".." segments.
 */
const MAX_SPAWN_ARG_LENGTH = 1024 * 1024;

/**
 * Validates a single argv string for use with {@link spawnSyncSafe} (no shell).
 */
export function assertSafeSpawnArg(arg: string): void {
    if (typeof arg !== "string") {
        throw new Error("Spawn argument must be a string");
    }
    if (arg.includes("\0")) {
        throw new Error("Spawn argument contains null byte");
    }
    if (arg.length > MAX_SPAWN_ARG_LENGTH) {
        throw new Error("Spawn argument is too long");
    }
}

export function assertSafeSpawnArgs(args: readonly string[]): string[] {
    const out: string[] = [];
    for (const arg of args) {
        assertSafeSpawnArg(arg);
        out.push(arg);
    }
    return out;
}

function assertSafeCwd(cwd: string | undefined): string | undefined {
    if (cwd === undefined) {
        return undefined;
    }
    if (typeof cwd !== "string" || cwd.includes("\0")) {
        throw new Error("Working directory must be a string without null bytes");
    }
    if (cwd.length > 8192) {
        throw new Error("Working directory path is too long");
    }
    return path.resolve(cwd);
}

export function assertSafeExecutableRef(file: string): void {
    if (typeof file !== "string" || file.length === 0) {
        throw new Error("Executable must be a non-empty string");
    }
    if (file.length > 4096) {
        throw new Error("Executable path is too long");
    }
    if (/[\0\n\r]/.test(file)) {
        throw new Error("Executable path contains invalid characters");
    }
    const hasDirSep = file.includes("/") || file.includes("\\");
    if (!hasDirSep) {
        if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(file)) {
            throw new Error("Invalid executable name");
        }
        return;
    }
    const normalized = path.normalize(file);
    if (normalized.split(path.sep).includes("..")) {
        throw new Error("Invalid executable path");
    }
}

export function assertSpawnOk(
    result: SpawnSyncReturns<string | Buffer>,
    what: string
): void {
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0 && result.status !== null) {
        throw new Error(`${what} failed (exit ${result.status})`);
    }
}

export interface SpawnSyncSafeOptions {
    cwd?: string;
    encoding?: BufferEncoding;
    stdio?: "inherit" | "pipe" | "ignore";
    maxBuffer?: number;
    env?: NodeJS.ProcessEnv;
}

/**
 * Runs a binary with argv (no shell). Use instead of execSync(string).
 */
export function spawnSyncSafe(
    file: string,
    args: readonly string[],
    options: SpawnSyncSafeOptions = {}
): SpawnSyncReturns<string | Buffer> {
    assertSafeExecutableRef(file);
    const validatedArgs = assertSafeSpawnArgs(args);
    const stdio =
        options.stdio === "inherit"
            ? ("inherit" as const)
            : options.stdio === "ignore"
              ? ("ignore" as const)
              : ("pipe" as const);

    const cwd = assertSafeCwd(options.cwd);
    return spawnSync(file, validatedArgs, {
        cwd,
        encoding: options.encoding ?? "utf8",
        stdio,
        shell: false,
        maxBuffer: options.maxBuffer,
        env: options.env,
    });
}
