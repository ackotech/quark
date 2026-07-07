import path from "path";
import { readFileSyncSafe } from "@quark-hq/quark-security";
import { QUARK_SCRIPTS_NPM_PACKAGE } from "./constants";

/**
 * Resolves the `@quark-hq/quark-scripts` version from the installed package (monorepo / node_modules)
 * so `pnpm add` pins the same version as the codebase.
 */
export function getQuarkScriptsDependencySpecifier(): string {
    try {
        const pkgPath = require.resolve(
            `${QUARK_SCRIPTS_NPM_PACKAGE}/package.json`
        );
        const pkgDir = path.dirname(pkgPath);
        const version = JSON.parse(
            readFileSyncSafe(pkgDir, pkgPath)
        ).version as string | undefined;
        if (version && /^[\w.+-]+$/.test(version)) {
            return `${QUARK_SCRIPTS_NPM_PACKAGE}@${version}`;
        }
    } catch {
        /* use fallback */
    }
    return `${QUARK_SCRIPTS_NPM_PACKAGE}@latest`;
}
