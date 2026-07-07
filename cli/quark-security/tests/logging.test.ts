import {
    formatErrorMessage,
    shouldLogErrorStack,
    stripUrlCredentials,
} from "../src/logging";

describe("stripUrlCredentials", () => {
    it("should_strip_userinfo_from_valid_url", () => {
        expect(stripUrlCredentials("https://user:secret@registry.example.com/pkg")).toBe(
            "https://registry.example.com/pkg"
        );
    });

    it("should_strip_userinfo_when_url_constructor_accepts_custom_scheme", () => {
        const out = stripUrlCredentials("not-a-url://user:pass@host");
        expect(out).not.toContain("user");
        expect(out).not.toContain("pass");
        expect(out).toContain("not-a-url://");
    });

    it("should_use_fallback_regex_when_url_constructor_throws", () => {
        // Protocol-relative URL without a base causes `new URL()` to throw; catch path uses replace().
        expect(stripUrlCredentials("//user:pass@host/path")).toMatch(/\/\/\*\*\*@host\/path/);
    });
});

describe("formatErrorMessage", () => {
    it("should_return_message_for_error", () => {
        expect(formatErrorMessage(new Error("oops"))).toBe("oops");
    });

    it("should_stringify_non_error", () => {
        expect(formatErrorMessage(42)).toBe("42");
    });
});

describe("shouldLogErrorStack", () => {
    const saved = { ...process.env };

    afterEach(() => {
        process.env.DEBUG = saved.DEBUG;
        process.env.NODE_ENV = saved.NODE_ENV;
    });

    it("should_return_true_when_DEBUG_is_1", () => {
        process.env.DEBUG = "1";
        expect(shouldLogErrorStack()).toBe(true);
    });

    it("should_return_true_when_DEBUG_is_true", () => {
        process.env.DEBUG = "true";
        expect(shouldLogErrorStack()).toBe(true);
    });

    it("should_return_true_when_NODE_ENV_is_development", () => {
        process.env.DEBUG = undefined;
        process.env.NODE_ENV = "development";
        expect(shouldLogErrorStack()).toBe(true);
    });

    it("should_return_false_otherwise", () => {
        process.env.DEBUG = undefined;
        process.env.NODE_ENV = "production";
        expect(shouldLogErrorStack()).toBe(false);
    });
});
