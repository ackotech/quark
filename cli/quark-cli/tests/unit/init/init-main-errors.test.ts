import fs from "fs";
import os from "os";
import path from "path";
import * as quarkSecurity from "@quark-hq/quark-security";
import { Init } from "../../../src/init/index";
import { DirectoryAlreadyExistsError } from "../../../src/errors/directory-errors";

jest.mock("../../../src/init/environment", () => ({
    ensureCliEnvironment: jest.fn().mockResolvedValue(undefined),
}));

const mockCreateNpmPackage = jest.fn();
const mockInitializePnpmWorkspace = jest.fn();
const mockInitializeGitRepository = jest.fn();
const mockWriteGithubWorkflows = jest.fn();
const mockInstallRootDependencies = jest.fn();
const mockAddRootScripts = jest.fn();
const mockCreateButtonComponent = jest.fn();
const mockCreateStorybookApplication = jest.fn();
const mockCreateDotenvFile = jest.fn();
const mockCreateDockerfile = jest.fn();
const mockCreateStandaloneGitignore = jest.fn();

jest.mock("../../../src/init/scaffold", () => ({
    createNpmPackage: (...args: unknown[]) => mockCreateNpmPackage(...args),
    initializePnpmWorkspace: (...args: unknown[]) =>
        mockInitializePnpmWorkspace(...args),
    initializeGitRepository: (...args: unknown[]) =>
        mockInitializeGitRepository(...args),
    writeGithubWorkflows: (...args: unknown[]) =>
        mockWriteGithubWorkflows(...args),
    installRootDependencies: (...args: unknown[]) =>
        mockInstallRootDependencies(...args),
    addRootScripts: (...args: unknown[]) => mockAddRootScripts(...args),
    createButtonComponent: (...args: unknown[]) =>
        mockCreateButtonComponent(...args),
    createStorybookApplication: (...args: unknown[]) =>
        mockCreateStorybookApplication(...args),
    createDotenvFile: (...args: unknown[]) => mockCreateDotenvFile(...args),
    createDockerfile: (...args: unknown[]) => mockCreateDockerfile(...args),
    createStandaloneGitignore: (...args: unknown[]) =>
        mockCreateStandaloneGitignore(...args),
}));

describe("Init.main error handling", () => {
    let tmpRoot: string;
    let cwdSpy: jest.SpyInstance;
    let exitSpy: jest.SpyInstance;
    let errSpy: jest.SpyInstance;
    let logSpy: jest.SpyInstance;
    let rmSyncSafeSpy: jest.SpiedFunction<typeof quarkSecurity.rmSyncSafe>;

    beforeEach(() => {
        jest.clearAllMocks();
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "quark-init-main-"));
        cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tmpRoot);
        exitSpy = jest
            .spyOn(process, "exit")
            .mockImplementation(((code?: number) => {
                throw new Error(`process.exit(${code})`);
            }) as (code?: string | number | null | undefined) => never);
        errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
        rmSyncSafeSpy = jest.spyOn(quarkSecurity, "rmSyncSafe");

        mockCreateNpmPackage.mockImplementation((projectName: string) => {
            const projectDir = path.join(tmpRoot, projectName);
            fs.mkdirSync(projectDir, { recursive: true });
        });
        mockInitializePnpmWorkspace.mockImplementation(() => {});
        mockInitializeGitRepository.mockImplementation(() => {});
        mockWriteGithubWorkflows.mockImplementation(() => {});
        mockInstallRootDependencies.mockImplementation(() => {});
        mockAddRootScripts.mockImplementation(() => {});
        mockCreateButtonComponent.mockImplementation(() => {});
        mockCreateStorybookApplication.mockImplementation(() => {});
        mockCreateDotenvFile.mockImplementation(() => {});
        mockCreateDockerfile.mockImplementation(() => {});
    });

    afterEach(() => {
        cwdSpy.mockRestore();
        exitSpy.mockRestore();
        errSpy.mockRestore();
        logSpy.mockRestore();
        rmSyncSafeSpy.mockRestore();
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    it("should_cleanup_project_when_scaffold_fails_after_create", async () => {
        mockInitializePnpmWorkspace.mockImplementation(() => {
            throw new Error("pnpm workspace failed");
        });

        const init = new Init("cleanup-proj");

        await expect(init.main()).rejects.toThrow("process.exit(1)");

        expect(rmSyncSafeSpy).toHaveBeenCalledWith(
            tmpRoot,
            path.join(tmpRoot, "cleanup-proj"),
            { recursive: true, force: true }
        );
        expect(errSpy).toHaveBeenCalledWith(
            expect.stringContaining("pnpm workspace failed")
        );
    });

    it("should_not_cleanup_when_directory_already_exists", async () => {
        mockCreateNpmPackage.mockImplementation(() => {
            throw new DirectoryAlreadyExistsError("existing-proj");
        });

        const init = new Init("existing-proj");

        await expect(init.main()).rejects.toThrow("process.exit(1)");

        expect(rmSyncSafeSpy).not.toHaveBeenCalled();
    });

    it("should_log_cleanup_failure_without_rethrowing", async () => {
        mockInitializePnpmWorkspace.mockImplementation(() => {
            throw new Error("mid-run failure");
        });
        rmSyncSafeSpy.mockImplementation(() => {
            throw new Error("rm failed");
        });

        const init = new Init("rm-fail-proj");

        await expect(init.main()).rejects.toThrow("process.exit(1)");

        expect(errSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to clean up "rm-fail-proj"')
        );
    });
});
