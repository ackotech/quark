import chalk from "chalk";

/**
 * Thrown when `quark unfreeze` cannot proceed because transitive workspace
 * dependencies are still marked frozen in the release map.
 */
export class UnfreezeBlockedByFrozenDependenciesError extends Error {
    readonly requestedPackage: string;
    readonly blockingPackages: readonly string[];

    constructor(requestedPackage: string, blockingPackages: string[]) {
        const pkgs = [...new Set(blockingPackages)].sort();
        const summary = `Cannot unfreeze "${requestedPackage}": frozen workspace dependencies — ${pkgs.join(", ")}.`;
        super(summary);
        this.name = "UnfreezeBlockedByFrozenDependenciesError";
        this.requestedPackage = requestedPackage;
        this.blockingPackages = pkgs;
        Object.setPrototypeOf(this, new.target.prototype);
    }

    /** Rich multi-line output for the CLI (used from the process entrypoint). */
    renderCli(): string {
        const bullets = this.blockingPackages
            .map((p) => `  ${chalk.yellow("•")} ${chalk.white(p)}`)
            .join("\n");
        return [
            "",
            chalk.red.bold("Unfreeze blocked"),
            "",
            chalk.red(this.message),
            "",
            chalk.gray(
                "This package still has workspace dependencies that are frozen in .release/map.json."
            ),
            chalk.gray(
                "Unfreeze from the bottom of the graph upward (leaf libs first), then middle layers, then apps."
            ),
            "",
            chalk.bold("Still frozen (resolve these first):"),
            bullets,
            "",
            chalk.dim(
                "Example: for A → B → C, run `quark unfreeze C`, then `quark unfreeze B`, then `quark unfreeze A`."
            ),
            "",
        ].join("\n");
    }
}
