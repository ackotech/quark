/**
 * Removes userinfo from URLs so registry URLs with embedded credentials are not logged.
 */
export function stripUrlCredentials(url: string): string {
    try {
        const u = new URL(url);
        u.username = "";
        u.password = "";
        return u.toString();
    } catch {
        return url.replace(/\/\/[^@/]+@/g, "//***@");
    }
}

/**
 * Safe one-line message for console (no stack unless debug).
 */
export function formatErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

export function shouldLogErrorStack(): boolean {
    return (
        process.env.DEBUG === "1" ||
        process.env.DEBUG === "true" ||
        process.env.NODE_ENV === "development"
    );
}
