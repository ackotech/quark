import { QUARK_SCRIPTS_NPM_PACKAGE } from "../../../src/init/constants";
import { getQuarkScriptsDependencySpecifier } from "../../../src/init/quark-scripts-spec";

describe("getQuarkScriptsDependencySpecifier", () => {
    it("should_return_scoped_package_specifier", () => {
        const spec = getQuarkScriptsDependencySpecifier();
        expect(spec).toMatch(
            new RegExp(
                `^${QUARK_SCRIPTS_NPM_PACKAGE.replace("/", "\\/")}@(?!latest$)[\\w.+-]+$`
            )
        );
    });
});
