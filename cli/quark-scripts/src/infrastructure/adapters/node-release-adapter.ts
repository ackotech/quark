import {
    assertPathInsideRoot,
    assertSpawnOk,
    readFileSafe,
    spawnSyncSafe,
    unlinkSafe,
    writeFileSafe,
} from "@quark-hq/quark-security";
import chalk from "chalk";
import { Graph, PackageMetadata } from "../../domain/graph";
import { collectTransitiveWorkspaceDependencies } from "../../domain/workspace-transitive-dependencies";
import { PackageMap } from "../../ports/map";
import { PromptResult } from "../../ports/prompts";
import { DevPublishContext } from "../../ports/platform-dev-publish-adapter";
import { GraphProvider } from "../../ports/graph";
import { QuarkConfig } from "../../ports/config";
import { Logger } from "../../ports/logger";
import { BaseReleaseAdapter } from "./base-release-adapter";
import { resolveWorkspaceDependencySpecifierForFreezeMap } from "../../domain/resolve-workspace-dependency-specifier-for-freeze-map";
import path from "path";
import {
    effectiveDevRegistryUrl,
    effectiveNodeScope,
} from "../config/nodeRegistryEnv";

export class NodeReleaseAdapter extends BaseReleaseAdapter {
    constructor(
        graphProvider: GraphProvider,
        quarkConfig: QuarkConfig,
        logger: Logger
    ) {
        super(graphProvider, quarkConfig, logger);
    }

    supports(meta: PackageMetadata): boolean {
        return meta.platform === "node";
    }

    protected getPlatformLabel(pkg: string): string {
        return chalk.bold.cyan(`📦  Releasing: ${pkg}`);
    }

    // ── Release: file writes ───────────────────────────────────────────

    protected async writePackageFiles(
        pkg: string,
        prompt: PromptResult,
        mapJsonObject: PackageMap,
        graph: Graph
    ): Promise<void> {
        const rootPath = await this.graphProvider.getPackageJson(pkg);
        const cwd = process.cwd();
        // bearer:disable javascript_lang_path_traversal
        const absRoot = assertPathInsideRoot(
            cwd,
            path.resolve(cwd, rootPath)
        );
        const packageJsonPath = path.join(absRoot, "package.json");
        const raw = await readFileSafe(cwd, packageJsonPath);
        const packageJson = JSON.parse(raw);

        packageJson.version = prompt.newVersion;

        if (prompt.frozen) {
            this.syncDependencyVersions(packageJson, "dependencies", mapJsonObject);
            this.syncDependencyVersions(packageJson, "peerDependencies", mapJsonObject);
            this.syncDependencyVersions(packageJson, "devDependencies", mapJsonObject);
            this.syncDependencyVersions(packageJson, "optionalDependencies", mapJsonObject);
            const pinned = this.collectPinnedWorkspaceDependencyVersions(
                pkg,
                packageJson,
                mapJsonObject,
                graph.adjacency
            );
            mapJsonObject[pkg] = {
                ...mapJsonObject[pkg],
                ...(Object.keys(pinned).length > 0
                    ? { pinnedDependencies: pinned }
                    : {}),
            };
        }

        await writeFileSafe(
            cwd,
            packageJsonPath,
            JSON.stringify(packageJson, null, 2)
        );
    }

    /**
     * After pinning, records each workspace package in the dependency closure (direct +
     * transitive in the graph) with the exact specifier used at freeze time (see
     * {@link resolveWorkspaceDependencySpecifierForFreezeMap}). package.json is only
     * updated for direct dependencies.
     */
    private collectPinnedWorkspaceDependencyVersions(
        pkg: string,
        packageJson: Record<string, any>,
        mapJsonObject: PackageMap,
        adjacency: Graph["adjacency"]
    ): Record<string, string> {
        const pinned: Record<string, string> = {};
        const depFields = [
            "dependencies",
            "peerDependencies",
            "devDependencies",
            "optionalDependencies",
        ] as const;
        for (const field of depFields) {
            const deps = packageJson[field];
            if (!deps || typeof deps !== "object") continue;
            for (const [depName, spec] of Object.entries(deps)) {
                if (typeof spec !== "string") continue;
                if (spec.startsWith("workspace:")) continue;
                if (
                    resolveWorkspaceDependencySpecifierForFreezeMap(
                        depName,
                        mapJsonObject
                    ) === undefined
                ) {
                    continue;
                }
                pinned[depName] = spec;
            }
        }

        const transitive = collectTransitiveWorkspaceDependencies(
            pkg,
            adjacency
        );
        for (const depName of transitive) {
            const spec = resolveWorkspaceDependencySpecifierForFreezeMap(
                depName,
                mapJsonObject
            );
            if (spec !== undefined) {
                pinned[depName] = spec;
            }
        }

        const sortedKeys = Object.keys(pinned).sort((a, b) =>
            a.localeCompare(b)
        );
        const ordered: Record<string, string> = {};
        for (const k of sortedKeys) {
            ordered[k] = pinned[k]!;
        }
        return ordered;
    }

    private syncDependencyVersions(
        packageJson: Record<string, any>,
        depField: string,
        mapJsonObject: PackageMap
    ): void {
        const deps = packageJson[depField];
        if (!deps) return;

        for (const depName of Object.keys(deps)) {
            const spec = resolveWorkspaceDependencySpecifierForFreezeMap(
                depName,
                mapJsonObject
            );
            if (spec !== undefined) {
                deps[depName] = spec;
            }
        }
    }

    /** Restore workspace dependency versions to workspace:* (used when unfreezing). */
    async restoreWorkspaceVersions(
        pkg: string,
        workspacePackageNames: Set<string>
    ): Promise<void> {
        const rootPath = await this.graphProvider.getPackageJson(pkg);
        const cwd = process.cwd();
        // bearer:disable javascript_lang_path_traversal
        const absRoot = assertPathInsideRoot(
            cwd,
            path.resolve(cwd, rootPath)
        );
        const packageJsonPath = path.join(absRoot, "package.json");
        const raw = await readFileSafe(cwd, packageJsonPath);
        const packageJson = JSON.parse(raw);

        const depFields = [
            "dependencies",
            "devDependencies",
            "peerDependencies",
            "optionalDependencies",
        ] as const;
        for (const field of depFields) {
            const deps = packageJson[field];
            if (!deps || typeof deps !== "object") continue;
            for (const depName of Object.keys(deps)) {
                if (workspacePackageNames.has(depName)) {
                    deps[depName] = "workspace:*";
                }
            }
        }

        await writeFileSafe(
            cwd,
            packageJsonPath,
            JSON.stringify(packageJson, null, 2)
        );
    }

    // ── Dev-publish ────────────────────────────────────────────────────

    async getCurrentVersion(packageDir: string): Promise<string> {
        const pkgJsonPath = path.join(packageDir, "package.json");
        const raw = await readFileSafe(packageDir, pkgJsonPath);
        return JSON.parse(raw).version ?? "1.0.0";
    }

    async publish(ctx: DevPublishContext, alphaVersion: string): Promise<void> {
        const { packageName, packageDir, repoRoot } = ctx;

        const safePackageDir = assertPathInsideRoot(repoRoot, packageDir);

        const pkgJsonPath = path.join(safePackageDir, "package.json");
        const originalPkgJson = await readFileSafe(repoRoot, pkgJsonPath);

        const pkgJson = JSON.parse(originalPkgJson);
        pkgJson.version = alphaVersion;
        await writeFileSafe(
            repoRoot,
            pkgJsonPath,
            JSON.stringify(pkgJson, null, 2)
        );
        this.logger.info(`Updated version to ${alphaVersion}`);

        const npmrcPath = path.join(repoRoot, ".npmrc");
        const originalNpmrc = await this.readFileOrNull(repoRoot, npmrcPath);
        await writeFileSafe(repoRoot, npmrcPath, this.buildDevNpmrc());
        this.logger.info("Overwrote project .npmrc with dev registry");

        try {
            this.logger.info(`Building package: ${packageName}`);
            assertSpawnOk(
                spawnSyncSafe("pnpm", ["run", "build"], {
                    cwd: safePackageDir,
                    stdio: "inherit",
                }),
                "pnpm run build"
            );

            this.logger.info(`Publishing ${packageName}@${alphaVersion}...`);
            assertSpawnOk(
                spawnSyncSafe(
                    "pnpm",
                    ["publish", "--no-git-check", "--access", "public"],
                    { cwd: safePackageDir, stdio: "inherit" }
                ),
                "pnpm publish"
            );

            this.logger.success(
                `Published ${packageName}@${alphaVersion} to dev registry`
            );
        } finally {
            if (originalNpmrc !== null) {
                await writeFileSafe(repoRoot, npmrcPath, originalNpmrc);
                this.logger.info("Restored original project .npmrc");
            } else {
                await unlinkSafe(repoRoot, npmrcPath).catch(() => {});
                this.logger.info("Removed temporary project .npmrc");
            }

            await writeFileSafe(repoRoot, pkgJsonPath, originalPkgJson);
            this.logger.info("Restored original package.json");
        }
    }

    private buildDevNpmrc(): string {
        const nodeConfig = this.quarkConfig.publish?.node;
        const registryUrl = effectiveDevRegistryUrl(nodeConfig);
        if (!registryUrl) {
            throw new Error(
                "Dev registry URL not configured. Set DEV_REGISTRY_URL in .env or publish.node.registryUrl (or publish.node.devRegistryUrl) in quark-config.json"
            );
        }
        const scope = effectiveNodeScope(nodeConfig);
        if (!scope) {
            throw new Error(
                "Registry scope not configured. Set SCOPE in .env or publish.node.scope in quark-config.json"
            );
        }

        const authToken =
            process.env.DEV_AUTH_TOKEN || process.env.NEXUS_DEV_AUTH;
        if (!authToken) {
            throw new Error(
                "Auth token required for dev publishing: set DEV_AUTH_TOKEN or NEXUS_DEV_AUTH"
            );
        }

        const registryPath = registryUrl.replace(/^https?:/, "");

        return [
            `${scope}:registry=${registryUrl}`,
            `${registryPath}:_auth=${authToken}`,
            `${registryPath}:always-auth=true`,
        ].join("\n") + "\n";
    }

    private async readFileOrNull(
        repoRoot: string,
        filePath: string
    ): Promise<string | null> {
        try {
            return await readFileSafe(repoRoot, filePath);
        } catch {
            return null;
        }
    }
}
