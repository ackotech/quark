export type PackageName = string;

export type AdjacencyList = Record<string, string[]>;

export type PackageMetadata = {
  rootDir: string;
  platform: string; // "node" | "maven" | future
};

export type PackageMetadataMap = Record<string, PackageMetadata>;

export type Graph = {
  adjacency: AdjacencyList;
  metadata: PackageMetadataMap;
};