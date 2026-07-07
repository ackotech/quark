import chalk from "chalk";
import { Graph, PackageMetadata } from "../../domain/graph";
import { collectTransitiveDependents } from "../../domain/transitive-dependents";
import { resolveNewPackageFreezeFromReleaseMap } from "../../domain/new-package-freeze-from-map";
import { TopoSorter } from "../../domain/topological-sorting";
import { PlatformReleaseAdapter } from "../../ports/platform-release-adapter";
import {
    PlatformDevPublishAdapter,
    DevPublishContext,
} from "../../ports/platform-dev-publish-adapter";
import prompts from "prompts";
import * as semver from "semver";
import { PackageMap } from "../../ports/map";
import { PromptResult, BumpType } from "../../ports/prompts";
import { GraphProvider } from "../../ports/graph";
import { QuarkConfig } from "../../ports/config";
import { Logger } from "../../ports/logger";

/**
 * Unified base for all platform adapters.
 *
 * Implements both PlatformReleaseAdapter (version-bump prompting, freeze
 * cascading, map.json writes) and PlatformDevPublishAdapter (alpha publish
 * to dev registry).
 *
 * Subclasses only implement platform detection, file writes, version reading,
 * and the dev-publish build+publish cycle.
 */
export abstract class BaseReleaseAdapter
    implements PlatformReleaseAdapter, PlatformDevPublishAdapter {
    protected userPrompts: Record<string, PromptResult> = {};

    private readonly topoSorter = new TopoSorter();

    constructor(
        protected readonly graphProvider: GraphProvider,
        protected readonly quarkConfig: QuarkConfig,
        protected readonly logger: Logger
    ) { }

    abstract supports(meta: PackageMetadata): boolean;

    protected abstract getPlatformLabel(pkg: string): string;

    protected abstract writePackageFiles(
        pkg: string,
        prompt: PromptResult,
        mapJsonObject: PackageMap,
        graph: Graph
    ): Promise<void>;

    // ── Dev-publish contract (subclasses implement) ────────────────────

    abstract getCurrentVersion(packageDir: string): Promise<string>;

    abstract publish(
        ctx: DevPublishContext,
        alphaVersion: string
    ): Promise<void>;

    async execute(
        packages: string[],
        graph: Graph,
        sorted: string[],
        existingMap: PackageMap
    ): Promise<Record<string, PromptResult>> {
        const sortedPackages = sorted.filter((pkg) => packages.includes(pkg));
        for (const pkg of sortedPackages) {
            if (!this.userPrompts[pkg]) {
                this.userPrompts[pkg] = await this.promptForPackage(
                    pkg,
                    graph,
                    existingMap,
                    sorted
                );
            }
        }

        return this.userPrompts;
    }

    async writeUserPromptsToFiles(
        pkg: string,
        prompt: PromptResult,
        mapJsonObject: PackageMap,
        graph: Graph
    ): Promise<void> {
        mapJsonObject[pkg] = {
            bumpType: prompt.bump,
            baseVersion: prompt.baseVersion,
            newVersion: prompt.newVersion,
            changeLog: prompt.changelog,
            frozen: prompt.frozen,
        };

        await this.writePackageFiles(pkg, prompt, mapJsonObject, graph);
    }

    // ── Prompting ──────────────────────────────────────────────────────

    private async promptForPackage(
        pkg: string,
        graph: Graph,
        existingMap: PackageMap,
        sorted: string[]
    ): Promise<PromptResult> {
        this.logger.info(
            "\n" + chalk.gray("──────────────────────────────────────────")
        );
        this.logger.info(this.getPlatformLabel(pkg));
        this.logger.info(
            chalk.gray("──────────────────────────────────────────\n")
        );
        const isNewPackage = !existingMap[pkg];
        const isFrozenPackage = existingMap[pkg]?.frozen;
        const isMajorBumpDisabled = isNewPackage || isFrozenPackage;
        const currentVersion = existingMap[pkg]?.newVersion || "1.0.0";
        const response = await prompts(
            [
                {
                    type: "select",
                    name: "bump",
                    message: chalk.yellow("Select version bump type"),
                    choices: this.buildBumpChoices(
                        currentVersion,
                        isNewPackage,
                        isFrozenPackage,
                        isMajorBumpDisabled
                    ),
                },
                {
                    type: "text",
                    name: "changelog",
                    message: chalk.yellow("Enter changelog description"),
                    validate: (value: string) =>
                        value.trim().length === 0
                            ? "Changelog cannot be empty"
                            : true,
                },
            ],
            {
                onCancel: () => {
                    throw new Error("Release cancelled by user");
                },
            }
        );

        const result: PromptResult = {
            bump: response.bump,
            frozen: existingMap[pkg]?.frozen || false,
            baseVersion: currentVersion,
            newVersion:
                response.bump === "new"
                    ? "1.0.0"
                    : semver.inc(currentVersion, response.bump) ?? "1.0.0",
            changelog: response.changelog,
        };

        if (isNewPackage) {
            const freezePolicy = resolveNewPackageFreezeFromReleaseMap(
                pkg,
                graph.adjacency,
                existingMap
            );
            if (freezePolicy.shouldFreeze) {
                result.frozen = true;
                const deps = freezePolicy.frozenWorkspaceDependencies.join(", ");
                this.logger.warn(
                    chalk.yellow(
                        `Package "${pkg}" is new but transitively depends on frozen workspace package(s) in .release/map.json (${deps}). ` +
                            `It will be marked frozen: workspace dependencies will be pinned to the versions in the map, and pinnedDependencies will be recorded.`
                    )
                );
            }
        }

        if (result.bump === "major") {
            await this.handleMajorVersionBumpConfig(pkg, graph, existingMap);
        }

        return result;
    }

    private buildBumpChoices(
        currentVersion: string,
        isNewPackage: boolean,
        isFrozenPackage: boolean | undefined,
        isMajorBumpDisabled: boolean | undefined
    ) {
        return [
            {
                title: "🆕  New Package",
                description: !isNewPackage
                    ? "Disabled as package already published"
                    : "New Package Found",
                value: "new",
                disabled: !isNewPackage,
            },
            {
                title: `🐛  Patch (bug fixes) ${isNewPackage ? "Disabled as package is new" : `→ ${semver.inc(currentVersion, "patch")}`}`,
                description: `→ ${semver.inc(currentVersion, "patch")}`,
                value: "patch",
                disabled: isNewPackage,
            },
            {
                title: `✨  Minor (new features) ${isNewPackage ? "Disabled as package is new" : `→ ${semver.inc(currentVersion, "minor")}`}`,
                description: `→ ${semver.inc(currentVersion, "minor")}`,
                value: "minor",
                disabled: isNewPackage,
            },
            {
                title: `💥  Major (breaking changes) ${isNewPackage ? "Disabled as package is new" : isFrozenPackage ? "Disabled as package is frozen" : `→ ${semver.inc(currentVersion, "major")}`}`,
                description: `→ ${semver.inc(currentVersion, "major")}`,
                value: "major",
                disabled: isMajorBumpDisabled,
            },
        ];
    }

    // ── Major-bump cascading ───────────────────────────────────────────

    private async handleMajorVersionBumpConfig(
        pkg: string,
        graph: Graph,
        existingMap: PackageMap
    ): Promise<void> {
        const invertedAdjacencyList =
            await this.graphProvider.getInvertedAdjacencyList(graph.adjacency);
        const transitiveDependents = collectTransitiveDependents(
            pkg,
            invertedAdjacencyList
        );
        const dependents =
            transitiveDependents.length === 0
                ? []
                : this.topoSorter.sort(graph.adjacency, transitiveDependents);

        if (dependents.length === 0) return;

        let choice = "none";

        if (this.quarkConfig?.release?.freeze) {
            const response = await prompts({
                type: "select",
                name: "dependencies",
                message: "Select the dependencies to freeze",
                choices: [
                    {
                        title: "All",
                        description:
                            "Freeze all dependents at their current published version",
                        value: "all",
                    },
                    {
                        title: "None",
                        description:
                            "Auto-cascade major bump to all dependents",
                        value: "none",
                    },
                    {
                        title: "Selective",
                        description:
                            "Select which dependents to freeze and which to cascade",
                        value: "selective",
                    },
                ],
            });
            choice = response.dependencies;
        }

        if (choice === "all") {
            this.freezeDependents(pkg, existingMap, dependents);
        } else if (choice === "none") {
            this.cascadeMajorBump(pkg, existingMap, dependents);
        } else if (choice === "selective") {
            await this.handleSelectiveMajorVersionBump(
                pkg,
                existingMap,
                dependents,
                invertedAdjacencyList
            );
        }
    }

    private cascadeMajorBump(
        pkg: string,
        existingMap: PackageMap,
        dependents: string[]
    ): void {
        for (const dependent of dependents) {
            const currentVersion =
                existingMap[dependent]?.newVersion || "1.0.0";
            this.userPrompts[dependent] = {
                bump: "major",
                frozen: false,
                baseVersion: currentVersion,
                newVersion:
                    semver.inc(currentVersion, "major") || "1.0.0",
                changelog: `Dependency version bumped to major version due to major version bump of ${pkg}`,
            };
        }
    }

    private freezeDependents(
        pkg: string,
        existingMap: PackageMap,
        dependents: string[]
    ): void {
        this.logger.info(`Handling frozen dependents for ${pkg}`);
        for (const dependent of dependents) {
            this.userPrompts[dependent] = {
                bump: (existingMap[dependent]?.bumpType as BumpType) ?? "patch",
                frozen: true,
                baseVersion: existingMap[dependent]?.baseVersion || "1.0.0",
                newVersion: existingMap[dependent]?.newVersion || "1.0.0",
                changelog: `Dependency version frozen due to major version bump of ${pkg}`,
            };
        }
    }

    // ── Selective freeze ───────────────────────────────────────────────

    private async handleSelectiveMajorVersionBump(
        pkg: string,
        existingMap: PackageMap,
        dependents: string[],
        invertedAdjacencyList: Record<string, string[]>
    ): Promise<void> {
        const MAX_ATTEMPTS = 5;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const selected =
                await this.promptSelectiveDependents(dependents);

            if (!selected || !Array.isArray(selected)) {
                this.logger.warn("No selection made. Operation cancelled.");
                return;
            }

            if (
                this.isValidTopologicalSelection(
                    dependents,
                    selected,
                    invertedAdjacencyList
                )
            ) {
                const unSelected = dependents.filter(
                    (dep) => !selected.includes(dep)
                );
                this.cascadeMajorBump(pkg, existingMap, unSelected);
                this.freezeDependents(pkg, existingMap, selected);
                return;
            }

            this.logger.error(
                "Invalid selection: freezing a package requires freezing every downstream dependent shown in this list. Please try again."
            );
        }

        throw new Error(
            "Maximum selection attempts exceeded. Release aborted."
        );
    }

    private async promptSelectiveDependents(
        dependents: string[]
    ): Promise<string[]> {
        const response = await prompts({
            type: "multiselect",
            name: "dependencies",
            message: "Select the dependencies to freeze",
            choices: dependents.map((dep) => ({
                title: dep,
                value: dep,
            })),
        });
        return response.dependencies;
    }

    private isValidTopologicalSelection(
        ordered: string[],
        selected: string[],
        invertedAdjacencyList: Record<string, string[]>
    ): boolean {
        if (selected.length === 0) return true;

        const selectedSet = new Set(selected);

        for (const node of selected) {
            const dependents = invertedAdjacencyList[node] ?? [];
            for (const dependent of dependents) {
                if (
                    ordered.includes(dependent) &&
                    !selectedSet.has(dependent)
                ) {
                    return false;
                }
            }
        }

        return true;
    }
}
