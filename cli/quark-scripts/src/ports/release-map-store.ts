import { PackageMap } from "./map";

export interface ReleaseMapStore {
    read(masterBranch: string): Promise<PackageMap>;
    readLocal(): Promise<PackageMap>;
    /**
     * Map used for interactive release: merges {@link read} (e.g. main) with
     * {@link readLocal} so working-tree changes (e.g. `frozen: false` after unfreeze)
     * win per-package over the branch snapshot until merged upstream.
     */
    readMergedWithLocal(masterBranch: string): Promise<PackageMap>;
    write(map: PackageMap): Promise<void>;
}
