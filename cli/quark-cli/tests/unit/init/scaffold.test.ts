import fs from "fs";
import os from "os";
import path from "path";
import * as quarkSecurity from "@quark-hq/quark-security";
import {
    ROOT_PACKAGE_SCRIPTS,
    PNPM_WORKSPACE_YAML,
    DEFAULT_NPMRC,
    PACKAGE_MANAGER_PIN,
} from "../../../src/init/constants";
import { DirectoryAlreadyExistsError } from "../../../src/errors/directory-errors";
import {
    addRootScripts,
    createButtonComponent,
    createDockerfile,
    createDotenvFile,
    createNpmPackage,
    createStandaloneGitignore,
    createStorybookApplication,
    initializeGitRepository,
    initializePnpmWorkspace,
    installRootDependencies,
    writeGithubWorkflows,
} from "../../../src/init/scaffold";

const spawnSyncSafeMock = jest.spyOn(quarkSecurity, "spawnSyncSafe");

function mockSpawnSuccess(): void {
    spawnSyncSafeMock.mockReturnValue({
        status: 0,
        stdout: "",
        stderr: "",
        pid: 1,
        output: [],
        signal: null,
        error: undefined,
    } as ReturnType<typeof quarkSecurity.spawnSyncSafe>);
}

function mockNpmInitWritesPackageJson(): void {
    spawnSyncSafeMock.mockImplementation((cmd, args, options) => {
        if (cmd === "npm" && args[0] === "init" && options?.cwd) {
            fs.writeFileSync(
                path.join(options.cwd as string, "package.json"),
                JSON.stringify({ name: "temp" })
            );
        }
        return {
            status: 0,
            stdout: "",
            stderr: "",
            pid: 1,
            output: [],
            signal: null,
            error: undefined,
        } as ReturnType<typeof quarkSecurity.spawnSyncSafe>;
    });
}

function withTmpWorkspace(
    run: (tmpRoot: string, projectName: string) => void
): void {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "quark-cli-scaffold-"));
    const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tmpRoot);
    const projectName = "test-proj";

    try {
        run(tmpRoot, projectName);
    } finally {
        cwdSpy.mockRestore();
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
}

describe("init/scaffold", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSpawnSuccess();
    });

    afterEach(() => {
        spawnSyncSafeMock.mockReset();
    });
    describe("writeGithubWorkflows", () => {
        it("should_write_github_workflows_under_dot_github", () => {
            const tmpRoot = fs.mkdtempSync(
                path.join(os.tmpdir(), "quark-cli-scaffold-")
            );
            const cwdSpy = jest
                .spyOn(process, "cwd")
                .mockReturnValue(tmpRoot);
            const projectName = "gh-wf-proj";
            fs.mkdirSync(path.join(tmpRoot, projectName), {
                recursive: true,
            });

            writeGithubWorkflows(projectName);

            const workflowsDir = path.join(
                tmpRoot,
                projectName,
                ".github",
                "workflows"
            );
            expect(fs.existsSync(path.join(workflowsDir, "ci.yaml"))).toBe(
                false
            );

            const prValPath = path.join(
                workflowsDir,
                "pr-branch-validation.yaml"
            );
            const prBody = fs.readFileSync(prValPath, "utf8");
            expect(prBody).toContain("name: PR Branch Validation");
            expect(prBody).toContain("pull_request:");
            expect(prBody).toContain("check-if-updated:");
            expect(prBody).toContain("git rev-list --count");

            const changelogPath = path.join(
                workflowsDir,
                "pr-changelog-comment.yaml"
            );
            const changelogBody = fs.readFileSync(changelogPath, "utf8");
            expect(changelogBody).toContain("name: PR Changelog Comment");
            expect(changelogBody).toContain("actions/github-script@v7");
            expect(changelogBody).toContain(".release/map.json");
            expect(changelogBody).toContain("freezeDeltaLine");

            const buildConflictPath = path.join(
                workflowsDir,
                "build-and-conflict-checks.yaml"
            );
            const buildConflictBody = fs.readFileSync(buildConflictPath, "utf8");
            expect(buildConflictBody).toContain("name: Build and conflict checks");
            expect(buildConflictBody).toContain("find-affected:");
            expect(buildConflictBody).toContain("nx run-many -t build");
            expect(buildConflictBody).toContain("run-script.outputs.affected");
            expect(buildConflictBody).toContain("set-no-changes");
            expect(buildConflictBody).toContain("normalizeForCompare");

            const releaseTagPath = path.join(
                workflowsDir,
                "monorepo-release-tagging.yaml"
            );
            const releaseTagBody = fs.readFileSync(releaseTagPath, "utf8");
            expect(releaseTagBody).toContain("name: Monorepo Release Tagging");
            expect(releaseTagBody).toContain("pull_request:");
            expect(releaseTagBody).toContain("create-release-tag:");
            expect(releaseTagBody).toContain("repos.createRelease");
            expect(releaseTagBody).toContain("normalizeForCompare");

            cwdSpy.mockRestore();
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        });
    });

    describe("createDotenvFile", () => {
        it("should_write_env_file_with_keys", () => {
            const cwdSpy = jest
                .spyOn(process, "cwd")
                .mockReturnValue("/workspace");
            const writeSpy = jest
                .spyOn(fs, "writeFileSync")
                .mockImplementation(() => {});

            try {
                createDotenvFile("my-proj", ["FOO", "BAR"]);

                const [writtenPath, writtenBody, opts] = writeSpy.mock.calls[0];
                expect(writtenPath).toContain("my-proj");
                expect(writtenPath).toMatch(/\.env$/);
                expect(writtenBody).toBe('FOO = ""\nBAR = ""\n');
                expect(opts).toEqual({ encoding: "utf8" });
            } finally {
                writeSpy.mockRestore();
                cwdSpy.mockRestore();
            }
        });
    });

    describe("createDockerfile", () => {
        it("should_write_dockerfile_with_quark_prod_publish_and_apps_storybook", () => {
            const tmpRoot = fs.mkdtempSync(
                path.join(os.tmpdir(), "quark-dockerfile-")
            );
            const cwdSpy = jest
                .spyOn(process, "cwd")
                .mockReturnValue(tmpRoot);
            const projectName = "docker-proj";
            fs.mkdirSync(path.join(tmpRoot, projectName), {
                recursive: true,
            });

            createDockerfile(projectName);

            const dockerPath = path.join(tmpRoot, projectName, "Dockerfile");
            const body = fs.readFileSync(dockerPath, "utf8");
            expect(body).toContain("quark-scripts prod-publish");
            expect(body).toContain("./apps/storybook");
            expect(body).toContain("corepack prepare");
            expect(body).toContain(".release/map.json");

            cwdSpy.mockRestore();
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        });
    });

    describe("createNpmPackage", () => {
        it("should_create_project_with_package_json_name", () => {
            mockNpmInitWritesPackageJson();

            withTmpWorkspace((tmpRoot, projectName) => {
                createNpmPackage(projectName);

                const pkgPath = path.join(tmpRoot, projectName, "package.json");
                expect(fs.existsSync(pkgPath)).toBe(true);
                expect(JSON.parse(fs.readFileSync(pkgPath, "utf8")).name).toBe(
                    projectName
                );
                expect(spawnSyncSafeMock).toHaveBeenCalledWith(
                    "npm",
                    ["init", "-y"],
                    expect.objectContaining({
                        cwd: path.join(tmpRoot, projectName),
                    })
                );
            });
        });

        it("should_throw_when_directory_already_exists", () => {
            withTmpWorkspace((tmpRoot, projectName) => {
                fs.mkdirSync(path.join(tmpRoot, projectName), {
                    recursive: true,
                });

                expect(() => createNpmPackage(projectName)).toThrow(
                    DirectoryAlreadyExistsError
                );
            });
        });

        it("should_throw_when_project_name_invalid", () => {
            withTmpWorkspace(() => {
                expect(() => createNpmPackage("bad name!")).toThrow(
                    /Invalid project name/
                );
            });
        });
    });

    describe("initializePnpmWorkspace", () => {
        it("should_write_workspace_files_and_update_package_json", () => {
            withTmpWorkspace((tmpRoot, projectName) => {
                const projectRoot = path.join(tmpRoot, projectName);
                fs.mkdirSync(projectRoot, { recursive: true });
                fs.writeFileSync(
                    path.join(projectRoot, "package.json"),
                    JSON.stringify({ name: projectName })
                );

                initializePnpmWorkspace(projectName);

                expect(
                    fs.readFileSync(
                        path.join(projectRoot, "pnpm-workspace.yaml"),
                        "utf8"
                    )
                ).toBe(PNPM_WORKSPACE_YAML);
                expect(
                    fs.readFileSync(path.join(projectRoot, ".npmrc"), "utf8")
                ).toBe(DEFAULT_NPMRC);
                expect(
                    fs.existsSync(path.join(projectRoot, ".release"))
                ).toBe(true);

                const pkg = JSON.parse(
                    fs.readFileSync(
                        path.join(projectRoot, "package.json"),
                        "utf8"
                    )
                );
                expect(pkg.private).toBe(true);
                expect(pkg.packageManager).toBe(PACKAGE_MANAGER_PIN);
            });
        });
    });

    describe("initializeGitRepository", () => {
        it("should_run_git_init_in_project_root", () => {
            withTmpWorkspace((tmpRoot, projectName) => {
                fs.mkdirSync(path.join(tmpRoot, projectName), {
                    recursive: true,
                });

                initializeGitRepository(projectName);

                expect(spawnSyncSafeMock).toHaveBeenCalledWith(
                    "git",
                    ["init"],
                    expect.objectContaining({
                        cwd: path.join(tmpRoot, projectName),
                    })
                );
            });
        });
    });

    describe("installRootDependencies", () => {
        it("should_run_pnpm_add_for_prod_and_dev_dependencies", () => {
            withTmpWorkspace((tmpRoot, projectName) => {
                fs.mkdirSync(path.join(tmpRoot, projectName), {
                    recursive: true,
                });

                installRootDependencies(projectName);

                expect(spawnSyncSafeMock).toHaveBeenCalledWith(
                    "pnpm",
                    expect.arrayContaining(["add", "-w"]),
                    expect.objectContaining({
                        cwd: path.join(tmpRoot, projectName),
                    })
                );
                expect(spawnSyncSafeMock).toHaveBeenCalledWith(
                    "pnpm",
                    expect.arrayContaining(["add", "-w", "-D"]),
                    expect.any(Object)
                );
            });
        });
    });

    describe("addRootScripts", () => {
        it("should_merge_root_scripts_into_package_json", () => {
            withTmpWorkspace((tmpRoot, projectName) => {
                const projectRoot = path.join(tmpRoot, projectName);
                fs.mkdirSync(projectRoot, { recursive: true });
                fs.writeFileSync(
                    path.join(projectRoot, "package.json"),
                    JSON.stringify({ name: projectName, scripts: {} })
                );

                addRootScripts(projectName);

                const pkg = JSON.parse(
                    fs.readFileSync(
                        path.join(projectRoot, "package.json"),
                        "utf8"
                    )
                );
                expect(pkg.scripts).toEqual(ROOT_PACKAGE_SCRIPTS);
            });
        });

        it("should_throw_when_package_json_missing", () => {
            withTmpWorkspace((tmpRoot, projectName) => {
                fs.mkdirSync(path.join(tmpRoot, projectName), {
                    recursive: true,
                });

                expect(() => addRootScripts(projectName)).toThrow(
                    /Cannot find package\.json/
                );
            });
        });
    });

    describe("createButtonComponent", () => {
        it("should_scaffold_button_package_with_source_files", () => {
            mockNpmInitWritesPackageJson();

            withTmpWorkspace((tmpRoot, projectName) => {
                fs.mkdirSync(path.join(tmpRoot, projectName), {
                    recursive: true,
                });

                createButtonComponent(projectName);

                const buttonDir = path.join(
                    tmpRoot,
                    projectName,
                    "packages",
                    "button"
                );
                expect(
                    fs.existsSync(path.join(buttonDir, "src", "button.tsx"))
                ).toBe(true);
                expect(
                    fs.existsSync(path.join(buttonDir, "src", "index.ts"))
                ).toBe(true);
                expect(
                    fs.existsSync(path.join(buttonDir, "vite.config.js"))
                ).toBe(true);
            });
        });
    });

    describe("createStorybookApplication", () => {
        it("should_scaffold_storybook_and_write_button_stories", () => {
            spawnSyncSafeMock.mockImplementation((cmd, args, options) => {
                if (cmd === "npm" && args[0] === "init" && options?.cwd) {
                    fs.writeFileSync(
                        path.join(options.cwd as string, "package.json"),
                        JSON.stringify({ name: "temp" })
                    );
                }
                if (
                    cmd === "pnpm" &&
                    args.includes("storybook@8.4.5") &&
                    options?.cwd
                ) {
                    fs.mkdirSync(path.join(options.cwd as string, "stories"), {
                        recursive: true,
                    });
                }
                return {
                    status: 0,
                    stdout: "",
                    stderr: "",
                    pid: 1,
                    output: [],
                    signal: null,
                    error: undefined,
                } as ReturnType<typeof quarkSecurity.spawnSyncSafe>;
            });

            withTmpWorkspace((tmpRoot, projectName) => {
                fs.mkdirSync(path.join(tmpRoot, projectName), {
                    recursive: true,
                });

                createStorybookApplication(projectName);

                const storiesPath = path.join(
                    tmpRoot,
                    projectName,
                    "apps",
                    "storybook",
                    "stories",
                    "Buttoa.stories.tsx"
                );
                expect(fs.existsSync(storiesPath)).toBe(true);
                expect(spawnSyncSafeMock).toHaveBeenCalledWith(
                    "pnpm",
                    expect.arrayContaining(["dlx", "storybook@8.4.5", "init"]),
                    expect.objectContaining({
                        cwd: path.join(
                            tmpRoot,
                            projectName,
                            "apps",
                            "storybook"
                        ),
                    })
                );
            });
        });
    });

    describe("createStandaloneGitignore", () => {
        it("should_write_standalone_gitignore", () => {
            withTmpWorkspace((tmpRoot, projectName) => {
                fs.mkdirSync(path.join(tmpRoot, projectName), {
                    recursive: true,
                });
                const logSpy = jest
                    .spyOn(console, "log")
                    .mockImplementation(() => {});

                try {
                    createStandaloneGitignore(projectName);

                    const gitignorePath = path.join(
                        tmpRoot,
                        projectName,
                        ".gitignore"
                    );
                    expect(fs.existsSync(gitignorePath)).toBe(true);
                    expect(fs.readFileSync(gitignorePath, "utf8")).toContain(
                        "node_modules"
                    );
                } finally {
                    logSpy.mockRestore();
                }
            });
        });
    });
});
