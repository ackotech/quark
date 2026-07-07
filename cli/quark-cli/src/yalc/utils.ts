import path from "path";
import {
    assertPathInsideRoot,
    assertSpawnOk,
    assertValidNpmPackageName,
    readFileSyncSafe,
    spawnSyncSafe,
    writeFileSyncSafe,
} from "@quark-hq/quark-security";

// Get the root of the Git repository
export const getGitRoot = (): string => {
    const r = spawnSyncSafe("git", ["rev-parse", "--show-toplevel"], {
        encoding: "utf-8",
        stdio: "pipe",
    });
    assertSpawnOk(r, "git rev-parse");
    return (r.stdout as string).trim();
};

// Get absolute path to a package using `nx show project`
export const getNxProjectPath = (packageName: string): string => {
    assertValidNpmPackageName(packageName, "package name");
    const r = spawnSyncSafe(
        "npx",
        ["--yes", "nx", "show", "project", packageName],
        { encoding: "utf-8", stdio: "pipe" }
    );
    assertSpawnOk(r, "nx show project");
    const depProjectInfo = (r.stdout as string).trim();
    const parsed = JSON.parse(depProjectInfo);
    const root = getGitRoot();
    const resolved = path.join(root, parsed.root);
    return assertPathInsideRoot(root, path.resolve(resolved));
};

// Read and parse package.json
export const readPackageJson = (pkgPath: string): any => {
    const root = getGitRoot();
    // bearer:disable javascript_lang_path_traversal
    const safe = assertPathInsideRoot(root, path.resolve(pkgPath));
    const content = readFileSyncSafe(root, safe);
    return JSON.parse(content);
};

// Write JSON back to package.json
export const writePackageJson = (pkgPath: string, pkgData: any) => {
    const root = getGitRoot();
    // bearer:disable javascript_lang_path_traversal
    const safe = assertPathInsideRoot(root, path.resolve(pkgPath));
    writeFileSyncSafe(root, safe, JSON.stringify(pkgData, null, 2));
};

// Replace all workspace:* versions with *
export const replaceWorkspaceVersions = (deps?: Record<string, string>) => {
    if (!deps) return;
    for (const key of Object.keys(deps)) {
        if (deps[key]?.startsWith("workspace:")) {
            deps[key] = "*";
        }
    }
};

// Run `yalc publish`
export const runYalcPublish = (cwd: string) => {
    assertSpawnOk(
        spawnSyncSafe("yalc", ["publish"], { cwd, stdio: "inherit" }),
        "yalc publish"
    );
};

// Run `yalc publish --push`
export const runYalcPublishWithPush = (cwd: string) => {
    assertSpawnOk(
        spawnSyncSafe("yalc", ["publish", "--push"], { cwd, stdio: "inherit" }),
        "yalc publish --push"
    );
};
