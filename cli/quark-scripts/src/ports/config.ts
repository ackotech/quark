export interface ReleaseConfig {
    masterBranch: string;
    autoCommit: boolean;
    autoBump: boolean;
    freeze: boolean;
}

export interface NodePublishConfig {
    registryUrl: string;
    devRegistryUrl?: string;
    prodRegistryUrl?: string;
    scope: string;
}

export interface MavenPublishConfig {
    repositoryUrl: string;
    devRepositoryUrl?: string;
    prodRepositoryUrl?: string;
    repositoryId: string;
}

export interface PublishConfig {
    node?: NodePublishConfig;
    maven?: MavenPublishConfig;
}

export interface QuarkConfig {
    release: ReleaseConfig;
    publish?: PublishConfig;
}
