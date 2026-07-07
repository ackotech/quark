import {
    ALLOWED_EXTERNAL_COMMANDS,
    MIN_NODE_MAJOR,
    ROOT_DEV_DEPENDENCIES,
    ROOT_PROD_DEPENDENCIES,
} from "../../../src/init/constants";

describe("init/constants", () => {
    it("should_list_allowed_external_commands", () => {
        expect(ALLOWED_EXTERNAL_COMMANDS.has("pnpm")).toBe(true);
        expect(ALLOWED_EXTERNAL_COMMANDS.has("yalc")).toBe(true);
    });

    it("should_require_reasonable_node_major", () => {
        expect(MIN_NODE_MAJOR).toBeGreaterThanOrEqual(18);
    });

    it("should_include_core_workspace_dependencies", () => {
        expect(ROOT_PROD_DEPENDENCIES).not.toContain("typescript");
        expect(ROOT_DEV_DEPENDENCIES).toContain("nx");
        expect(ROOT_DEV_DEPENDENCIES).toContain("dotenv");
    });
});
