export interface ProcessRunner {
    /**
     * Runs a program with argv (no shell). Prefer over string commands.
     */
    run(
        file: string,
        args: readonly string[],
        options?: { cwd?: string }
    ): void;
}