export interface NpmNameValidation {
    valid: boolean;
    reason: string;
}

/**
 * Validates npm-style package or folder names (aligned with npm package name rules used in init).
 */
export function validateNpmPackageName(name: string): NpmNameValidation {
    const nameRegex = /^(?:@[\w-]+\/)?[\w.-]+$/;
    if (!nameRegex.test(name)) {
        return {
            valid: false,
            reason:
                "The name must be a valid npm package name (alphanumeric, dashes, dots, optional @scope/).",
        };
    }
    if (
        name.trim().length === 0 ||
        name.includes(" ") ||
        name.toLowerCase() !== name ||
        name.startsWith(".") ||
        name.startsWith("_")
    ) {
        return {
            valid: false,
            reason: "The name contains invalid characters or formatting.",
        };
    }
    return { valid: true, reason: "" };
}

export function assertValidNpmPackageName(name: string, label: string): void {
    const r = validateNpmPackageName(name);
    if (!r.valid) {
        throw new Error(`${label}: ${r.reason}`);
    }
}
