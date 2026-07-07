import { NodePublishConfig } from "../../ports/config";

/**
 * Normalizes a value from `process.env` or config (trim, strip surrounding quotes).
 */
export function normalizeEnvString(value: string | undefined): string {
    if (value === undefined) {
        return "";
    }
    const t = value.trim();
    if (!t) {
        return "";
    }
    if (
        (t.startsWith("'") && t.endsWith("'")) ||
        (t.startsWith('"') && t.endsWith('"'))
    ) {
        return t.slice(1, -1).trim();
    }
    return t;
}

/** Dev registry: `DEV_REGISTRY_URL`, then quark-config `devRegistryUrl` / `registryUrl`. */
export function effectiveDevRegistryUrl(
    node: NodePublishConfig | undefined
): string {
    return (
        normalizeEnvString(process.env.DEV_REGISTRY_URL) ||
        normalizeEnvString(node?.devRegistryUrl) ||
        normalizeEnvString(node?.registryUrl)
    );
}

/** Prod registry: `PROD_REGISTRY_URL`, then quark-config `prodRegistryUrl` / `registryUrl`. */
export function effectiveProdRegistryUrl(
    node: NodePublishConfig | undefined
): string {
    return (
        normalizeEnvString(process.env.PROD_REGISTRY_URL) ||
        normalizeEnvString(node?.prodRegistryUrl) ||
        normalizeEnvString(node?.registryUrl)
    );
}

/** Scope: `SCOPE`, then quark-config `publish.node.scope`. */
export function effectiveNodeScope(node: NodePublishConfig | undefined): string {
    return (
        normalizeEnvString(process.env.SCOPE) ||
        normalizeEnvString(node?.scope) ||
        ""
    );
}
