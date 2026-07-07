import { assertSpawnOk, spawnSyncSafe } from "@quark-hq/quark-security";
import { ProcessRunner } from "../../ports/processRunner";

export class NodeProcessRunner implements ProcessRunner {
    run(
        file: string,
        args: readonly string[],
        options?: { cwd?: string }
    ): void {
        const result = spawnSyncSafe(file, [...args], {
            cwd: options?.cwd,
            stdio: "inherit",
        });
        assertSpawnOk(result, `${file} ${args.join(" ")}`);
    }
}
