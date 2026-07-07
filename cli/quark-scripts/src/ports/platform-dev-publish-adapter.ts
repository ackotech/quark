import { PackageMetadata } from "../domain/graph";

export interface DevPublishContext {
    packageName: string;
    packageDir: string;
    repoRoot: string;
}

export interface PlatformDevPublishAdapter {
    supports(meta: PackageMetadata): boolean;
    getCurrentVersion(packageDir: string): Promise<string>;
    publish(ctx: DevPublishContext, alphaVersion: string): Promise<void>;
}
