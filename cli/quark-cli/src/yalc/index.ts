import path from "path";
import {
    assertPathInsideRoot,
    assertSpawnOk,
    assertValidNpmPackageName,
    readFileSyncSafe,
    spawnSyncSafe,
    writeFileSyncSafe,
} from "@quark-hq/quark-security";
import {
    getGitRoot,
    getNxProjectPath,
    writePackageJson,
    replaceWorkspaceVersions,
    runYalcPublish,
    runYalcPublishWithPush,
} from "./utils";

const MAX_LOG_OUTPUT = 500;

function truncateForLog(text: string): string {
    const t = text.trim();
    if (t.length <= MAX_LOG_OUTPUT) return t;
    return `${t.slice(0, MAX_LOG_OUTPUT)}…`;
}

/**
 * Prepare the package by resolving path and updating workspace dependencies.
 */
const preparePackageForYalc = (packageName: string): { packagePath: string; pkgJsonPath: string; originalContent: string } => {
    const packagePath = getNxProjectPath(packageName);
    const pkgJsonPath = assertPathInsideRoot(
        getGitRoot(),
        // bearer:disable javascript_lang_path_traversal
        path.resolve(packagePath, "package.json")
    );

    console.log(`📂 Package path resolved: ${packagePath}`);

    try {
        console.log(`🏗️ Building package "${packageName}"...`);
        assertSpawnOk(
            spawnSyncSafe("npm", ["run", "build"], {
                cwd: packagePath,
                stdio: "inherit",
            }),
            "npm run build"
        );
        console.log(`🏗️ Build completed for "${packageName}"`);
    } catch (buildErr: any) {
        const msg =
            buildErr instanceof Error ? buildErr.message : String(buildErr);
        console.error(`❌ Build failed for "${packageName}": ${msg}`);
        throw buildErr;
    }


    const originalContent = readFileSyncSafe(getGitRoot(), pkgJsonPath);
    const pkg = JSON.parse(originalContent);

    replaceWorkspaceVersions(pkg.dependencies);
    replaceWorkspaceVersions(pkg.devDependencies);
    replaceWorkspaceVersions(pkg.peerDependencies);
    writePackageJson(pkgJsonPath, pkg);

    return { packagePath, pkgJsonPath, originalContent };
};

/**
 * Restore the original package.json and optionally clean up changes.
 */
const restorePackageJson = (pkgJsonPath: string, originalContent: string, packageName: string) => {
    const root = getGitRoot();
    // bearer:disable javascript_lang_path_traversal
    const safe = assertPathInsideRoot(root, path.resolve(pkgJsonPath));
    writeFileSyncSafe(root, safe, originalContent);
    console.log(`🔄 package.json restored for "${packageName}"`);
};

/**
 * Execute the actual yalc publish or push operation.
 */
const performYalcPublish = (packagePath: string, packageName: string, shouldPush: boolean) => {
    try {
        if (shouldPush) {
            runYalcPublishWithPush(packagePath);
        } else {
            runYalcPublish(packagePath);
        }
        console.log(`✅ "${packageName}" published successfully${shouldPush ? " and pushed" : ""}.`);
    } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`❌ Failed to publish "${packageName}": ${msg}`);
    }
};

/**
 * Publishes a package to Yalc with optional push.
 */
export const localPublish = (packageName: string, shouldPush = false) => {
    console.log(`📦 Publishing "${packageName}" to local Yalc${shouldPush ? " with --push" : ""}...`);

    const { packagePath, pkgJsonPath, originalContent } = preparePackageForYalc(packageName);

    performYalcPublish(packagePath, packageName, shouldPush);

    restorePackageJson(pkgJsonPath, originalContent, packageName);
};


export const addPackage = (packageName: string) => {
    assertValidNpmPackageName(packageName, "package name");
    console.log(`🔗 Adding ${packageName} to current project...`);

    const result = spawnSyncSafe("yalc", ["add", packageName], {
        cwd: process.cwd(),
        encoding: "utf-8",
    });

    const combinedOutput = `${result.stdout || ""}\n${result.stderr || ""}`;

    if (combinedOutput.includes("Could not read") || combinedOutput.includes("No package.json")) {
        console.error(`❌ yalc failed: ${truncateForLog(combinedOutput)}`);
        return;
    }

    if (result.error) {
        console.error("❌ Failed to run yalc:", result.error.message);
        return;
    }

    if (result.status !== 0) {
        console.error("❌ yalc exited with non-zero status:", result.status);
        return;
    }

    console.log(`✅ Successfully linked ${packageName} via yalc.`);
};

export const removePackage = (packageName: string, all: boolean) => {
    if (all) {
      console.log("❌ Removing all yalc packages from current project...");
  
      const result = spawnSyncSafe("yalc", ["remove", "--all"], {
        cwd: process.cwd(),
        encoding: "utf-8",
      });
  
      const combinedOutput = `${result.stdout || ""}\n${result.stderr || ""}`;
  
      if (combinedOutput.includes("Could not read") || combinedOutput.includes("No package.json")) {
        console.error(`❌ yalc failed: ${truncateForLog(combinedOutput)}`);
        return;
      }
  
      if (result.error) {
        console.error("❌ Failed to run yalc:", result.error.message);
        return;
      }
  
      if (result.status !== 0) {
        console.error("❌ yalc exited with non-zero status:", result.status);
        return;
      }
  
      console.log("✅ Successfully removed all yalc packages.");
    } else {
      assertValidNpmPackageName(packageName, "package name");
      console.log(`❌ Removing ${packageName} from current project...`);
  
      const result = spawnSyncSafe("yalc", ["remove", packageName], {
        cwd: process.cwd(),
        encoding: "utf-8",
      });
  
      const combinedOutput = `${result.stdout || ""}\n${result.stderr || ""}`;
  
      if (combinedOutput.includes("Could not read") || combinedOutput.includes("No package.json")) {
        console.error(`❌ yalc failed: ${truncateForLog(combinedOutput)}`);
        return;
      }
  
      if (result.error) {
        console.error("❌ Failed to run yalc:", result.error.message);
        return;
      }
  
      if (result.status !== 0) {
        console.error("❌ yalc exited with non-zero status:", result.status);
        return;
      }
  
      console.log(`✅ Successfully removed ${packageName} via yalc.`);
    }
  };