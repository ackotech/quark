import { DirectoryAlreadyExistsError } from "../../../src/errors/directory-errors";

describe("DirectoryAlreadyExistsError", () => {
    it("should_set_name_and_message", () => {
        const err = new DirectoryAlreadyExistsError("my-pkg");

        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe("DirectoryAlreadyExistsError");
        expect(err.message).toBe('Directory "my-pkg" already exists.');
    });
});
