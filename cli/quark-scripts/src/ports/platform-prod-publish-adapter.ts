import { PackageMetadata } from "../domain/graph";

export interface PackageIdentity {
    name: string;
    version: string;
}

export interface PlatformProdPublishAdapter {
    supports(meta: PackageMetadata): boolean;
    readPackageIdentity(packageDir: string): Promise<PackageIdentity>;
    versionExistsInRegistry(packageName: string, version: string): Promise<boolean>;
    publish(packageDir: string): Promise<void>;
}
