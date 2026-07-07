export interface GitService {
    getRepositoryRoot(): Promise<string>;
    getCurrentBranch(): Promise<string>;
    fetch(branch: string): Promise<void>;
    commitsBehind(branch: string): Promise<number>;
    getChangedFiles(baseBranch: string): Promise<string[]>;
    readFile(path: string, branch: string): Promise<string>;
    readFileFromRef(filePath: string, ref: string): Promise<string>;
    /**
     * `[previousTag, latestTag]`. `previousTag` is `null` when there is no older tag
     * (first release, or `targetTag` is the oldest tag).
     */
    getTags(targetTag?: string): Promise<[string | null, string]>;
}