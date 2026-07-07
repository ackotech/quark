import chalk from "chalk";
import path from "path";
import {
    assertPathInsideRoot,
    assertSpawnOk,
    assertValidNpmPackageName,
    existsSyncSafe,
    mkdirSyncSafe,
    spawnSyncSafe,
    writeFileSyncSafe,
} from "@quark-hq/quark-security";
import { DirectoryAlreadyExistsError } from "../errors/directory-errors";

function resolvePackageDir(packageName: string): string {
    assertValidNpmPackageName(packageName, "package name");
    // bearer:disable javascript_lang_path_traversal
    const dir = path.resolve(process.cwd(), packageName);
    return assertPathInsideRoot(process.cwd(), dir);
}

/**
 * Writes a package.json file for the specified template type.<br>
 * @param templateType {string} The name of the template (e.g. 'vite', 'webpack')
 * @param packageDir {string} The directory where package.json should be created.
 * @param packageName {string} The name to use in the package.json (passed to the template function)
 */
const writePackageJson = (templateType: string, packageDir: string, packageName: string) => {
  // bearer:disable javascript_lang_path_traversal
  const safeDir = assertPathInsideRoot(process.cwd(), path.resolve(packageDir));
  const templateModule = require(`../templates/${templateType}/package-json`);
  const packageJsonTemplateFn = templateModule.packageJson;
  const content = typeof packageJsonTemplateFn === "function"
    ? packageJsonTemplateFn(packageName)
    : packageJsonTemplateFn;
  const packageJsonPath = assertPathInsideRoot(
    process.cwd(),
    // bearer:disable javascript_lang_path_traversal
    path.resolve(safeDir, "package.json")
  );
  writeFileSyncSafe(process.cwd(), packageJsonPath, content, "utf8");
};

/**
 * Writes a tsconfig.json file for the specified template type.<br>
 * @param templateType {string} The name of the template (e.g. 'vite', 'webpack')
 * @param packageDir {string} The directory where tsconfig.json should be created.
 */
const writeTsconfigJson = (templateType: string, packageDir: string) => {
  // bearer:disable javascript_lang_path_traversal
  const safeDir = assertPathInsideRoot(process.cwd(), path.resolve(packageDir));
  const templateModule = require(`../templates/${templateType}/tsconfig`);
  const tsconfigContent = templateModule.tsconfig;
  const tsconfigPath = assertPathInsideRoot(
    process.cwd(),
    // bearer:disable javascript_lang_path_traversal
    path.resolve(safeDir, "tsconfig.json")
  );
  writeFileSyncSafe(process.cwd(), tsconfigPath, tsconfigContent, "utf8");
};

/**
 * Writes a bundler config file for the specified template type.
 * @param templateType {string} The name of the template (e.g. 'vite', 'webpack')
 * @param packageDir {string} The directory where the config file should be created.
 */
const writeBundlerConfig = (templateType: string, packageDir: string) => {
  // bearer:disable javascript_lang_path_traversal
  const safeDir = assertPathInsideRoot(process.cwd(), path.resolve(packageDir));
  const configModule = require(`../templates/${templateType}/${templateType}.config`);
  const configContent = configModule.default || configModule[`${templateType}Config`] || configModule.config || configModule;
  const configFileName = `${templateType}.config.js`;
  const configPath = assertPathInsideRoot(
    process.cwd(),
    // bearer:disable javascript_lang_path_traversal
    path.resolve(safeDir, configFileName)
  );
  writeFileSyncSafe(process.cwd(), configPath, configContent, "utf8");
};

/**
 * Writes an index.ts file containing 'export {};' in the specified file path.
 * Ensures any missing parent directories are created.
 * @param filePath {string} The full path (e.g., '/path/to/src/index.ts')
 */
const writeEmptyIndexTs = (filePath: string) => {
  // bearer:disable javascript_lang_path_traversal
  const safePath = assertPathInsideRoot(process.cwd(), path.resolve(filePath));
  const dir = path.dirname(safePath);
  const root = process.cwd();
  if (!existsSyncSafe(root, dir)) {
    mkdirSyncSafe(root, dir, { recursive: true });
  }
  writeFileSyncSafe(root, safePath, "export {};\n", "utf8");
};

/**
 * Writes Vite library layout (package.json, tsconfig, vite.config, src/index.ts stub).
 * Used by `quark create` for the default packages/button scaffold.
 */
export function scaffoldViteReactPackageFiles(
    packageDir: string,
    packageName: string
): void {
    writePackageJson("vite", packageDir, packageName);
    writeTsconfigJson("vite", packageDir);
    writeBundlerConfig("vite", packageDir);
    writeEmptyIndexTs(path.join(packageDir, "src", "index.ts"));
}



const createViteReactPackage = (packageName: string, verbose?: boolean) => {
  const packageDir = resolvePackageDir(packageName);
  if (existsSyncSafe(process.cwd(), packageDir)) {
    throw new DirectoryAlreadyExistsError(packageName);
  }
  mkdirSyncSafe(process.cwd(), packageDir, { recursive: true });
  assertSpawnOk(
    spawnSyncSafe("npm", ["init", "-y"], { cwd: packageDir, stdio: "ignore" }),
    "npm init"
  );

  writePackageJson("vite", packageDir, packageName);
  writeTsconfigJson("vite", packageDir);
  writeBundlerConfig("vite", packageDir);
  // bearer:disable javascript_lang_path_traversal
  writeEmptyIndexTs(path.join(packageDir, "src", "index.ts"));

  console.log(chalk.cyan("Installing dependencies..."));

  const addArgs = [
    "add",
    "-D",
    "@types/react@^17.0.8",
    "@types/react-dom@^17.0.5",
    "@types/node@12.20.4",
    "@babel/runtime@7.20.0",
  ];
  if (verbose) {
    addArgs.push("--loglevel=debug");
  }

  assertSpawnOk(
    spawnSyncSafe("pnpm", addArgs, { cwd: packageDir, stdio: "inherit" }),
    "pnpm add"
  );

  console.log(chalk.cyan("Dependencies installed"));
}

const createWebpackReactPackage = (packageName: string, verbose?: boolean) => {
  const packageDir = resolvePackageDir(packageName);

  if (existsSyncSafe(process.cwd(), packageDir)) {
    throw new DirectoryAlreadyExistsError(packageName);
  }

  mkdirSyncSafe(process.cwd(), packageDir, { recursive: true });

  assertSpawnOk(
    spawnSyncSafe("npm", ["init", "-y"], { cwd: packageDir, stdio: "ignore" }),
    "npm init"
  );

  writeTsconfigJson("webpack", packageDir);

  writePackageJson("webpack", packageDir, packageName);

  writeBundlerConfig("webpack", packageDir);

  // bearer:disable javascript_lang_path_traversal
  writeEmptyIndexTs(path.join(packageDir, "src", "index.ts"));

  console.log(chalk.cyan("Installing dependencies..."));

  const installArgs = ["install"];
  if (verbose) {
    installArgs.push("--loglevel=debug");
  }

  assertSpawnOk(
    spawnSyncSafe("pnpm", installArgs, { cwd: packageDir, stdio: "inherit" }),
    "pnpm install"
  );

  console.log(chalk.cyan("Dependencies installed"));
}


export {  createViteReactPackage, createWebpackReactPackage };
