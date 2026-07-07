import { Graph } from "../domain/graph";

export interface GraphProvider {
    build(): Promise<Graph>;
    getInvertedAdjacencyList(adjacency: Record<string, string[]>): Promise<Record<string, string[]>>;
    getPackageJson(pkg: string): Promise<string>;
}

export interface NxGraphOutput {
    graph: NxProjectGraph;
}

export interface NxProjectGraph {
    dependencies: Record<string, NxDependency[]>;
    nodes: Record<string, NxNode>;
}

export interface NxDependency {
    target: string;
}

export interface NxNode {
    name: string;
    type: string;
    data: NxNodeData;
}

export interface NxNodeData {
    root: string;
    tags?: string[];
    packageMetadata?: NxPackageMetadata;
}

export interface NxPackageMetadata {
    platform?: string;
}
