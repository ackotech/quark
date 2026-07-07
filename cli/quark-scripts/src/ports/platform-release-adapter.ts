import { Graph, PackageMetadata } from "../domain/graph";
import { PackageMap } from "./map";
import { PromptResult } from "./prompts";

export interface PlatformReleaseAdapter {
    supports(meta: PackageMetadata): boolean;

    execute(
        packages: string[],
        graph: Graph,
        sorted: string[],
        existingMap: PackageMap
    ): Promise<Record<string, PromptResult>>;

    writeUserPromptsToFiles(
        pkg: string,
        prompt: PromptResult,
        mapJsonObject: PackageMap,
        graph: Graph
    ): Promise<void>;
}
