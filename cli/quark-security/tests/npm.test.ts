import { validateNpmPackageName, assertValidNpmPackageName } from "../src/npm";

describe("validateNpmPackageName", () => {
    it("should_accept_scoped_name", () => {
        expect(validateNpmPackageName("@scope/button").valid).toBe(true);
    });

    it("should_accept_unscoped_lowercase", () => {
        expect(validateNpmPackageName("my-pkg").valid).toBe(true);
    });

    it("should_reject_invalid_regex", () => {
        expect(validateNpmPackageName("bad name").valid).toBe(false);
    });

    it("should_reject_uppercase", () => {
        expect(validateNpmPackageName("My-Pkg").valid).toBe(false);
    });

    it("should_reject_leading_dot", () => {
        expect(validateNpmPackageName(".hidden").valid).toBe(false);
    });

    it("should_reject_leading_underscore", () => {
        expect(validateNpmPackageName("_private").valid).toBe(false);
    });
});

describe("assertValidNpmPackageName", () => {
    it("should_throw_on_invalid", () => {
        expect(() => assertValidNpmPackageName("../escape", "x")).toThrow();
    });

    it("should_not_throw_when_valid", () => {
        expect(() => assertValidNpmPackageName("valid-name", "label")).not.toThrow();
    });
});
