import chalk from "chalk";

/** Short step line for the create flow (avoids noisy child-process output). */
export function logStep(message: string): void {
    console.log(chalk.cyan(`→ ${message}`));
}

export function logSuccess(message: string): void {
    console.log(chalk.green(`✅ ${message}`));
}

/** Prefix for pnpm argv to reduce install noise (pnpm 8+). */
export const PNPM_SILENT_PREFIX = ["--reporter", "silent"] as const;
