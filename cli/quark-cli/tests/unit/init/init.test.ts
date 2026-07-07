import { Init } from "../../../src/init/index";

jest.mock("../../../src/init/environment", () => ({
    ensureCliEnvironment: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../src/init/scaffold", () => ({
    createNpmPackage: jest.fn(),
    initializePnpmWorkspace: jest.fn(),
    initializeGitRepository: jest.fn(),
    writeGithubWorkflows: jest.fn(),
    installRootDependencies: jest.fn(),
    addRootScripts: jest.fn(),
    createButtonComponent: jest.fn(),
    createStorybookApplication: jest.fn(),
    createDotenvFile: jest.fn(),
    createDockerfile: jest.fn(),
    createStandaloneGitignore: jest.fn(),
}));

import * as Scaffold from "../../../src/init/scaffold";
import { ensureCliEnvironment } from "../../../src/init/environment";

describe("Init", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should_run_bootstrap_steps_in_order", async () => {
        const init = new Init("test-proj");
        await init.main();

        expect(ensureCliEnvironment).toHaveBeenCalled();
        expect(Scaffold.createNpmPackage).toHaveBeenCalledWith("test-proj");
        expect(Scaffold.initializePnpmWorkspace).toHaveBeenCalledWith(
            "test-proj"
        );
        expect(Scaffold.initializeGitRepository).toHaveBeenCalledWith(
            "test-proj"
        );
        expect(Scaffold.writeGithubWorkflows).toHaveBeenCalledWith("test-proj");
        expect(Scaffold.installRootDependencies).toHaveBeenCalledWith(
            "test-proj"
        );
        expect(Scaffold.addRootScripts).toHaveBeenCalledWith("test-proj");
        expect(Scaffold.createButtonComponent).toHaveBeenCalledWith(
            "test-proj"
        );
        expect(Scaffold.createStorybookApplication).toHaveBeenCalledWith(
            "test-proj"
        );
        expect(Scaffold.createDotenvFile).toHaveBeenCalledWith(
            "test-proj",
            expect.any(Array)
        );
        expect(Scaffold.createDockerfile).toHaveBeenCalledWith("test-proj");
    });

    it("should_delegate_createNpmPackage_to_scaffold", () => {
        const init = new Init("x");
        init.createNpmPackage("x");
        expect(Scaffold.createNpmPackage).toHaveBeenCalledWith("x");
    });

    it("should_delegate_writeGithubWorkflows_to_scaffold", () => {
        const init = new Init("x");
        init.writeGithubWorkflows("x");
        expect(Scaffold.writeGithubWorkflows).toHaveBeenCalledWith("x");
    });
});
