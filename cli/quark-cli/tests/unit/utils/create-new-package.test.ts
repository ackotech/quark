import fs from "fs";
import os from "os";
import path from "path";
import * as quarkSecurity from "@quark-hq/quark-security";
import { DirectoryAlreadyExistsError } from "../../../src/errors/directory-errors";
import {
    createViteReactPackage,
    createWebpackReactPackage,
    scaffoldViteReactPackageFiles,
} from "../../../src/utils/create-new-package";

describe("utils/create-new-package", () => {
    let tmpRoot: string;
    let cwdSpy: jest.SpyInstance;
    let spawnSyncSafeMock: jest.SpiedFunction<
        typeof quarkSecurity.spawnSyncSafe
    >;

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

    beforeEach(() => {
        jest.clearAllMocks();
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "quark-create-pkg-"));
        cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tmpRoot);
        spawnSyncSafeMock = jest.spyOn(quarkSecurity, "spawnSyncSafe");
        mockSpawnSuccess();
    });

    afterEach(() => {
        cwdSpy.mockRestore();
        spawnSyncSafeMock.mockRestore();
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    describe("scaffoldViteReactPackageFiles", () => {
        it("should_write_vite_package_layout", () => {
            const packageDir = path.join(tmpRoot, "packages", "button");
            fs.mkdirSync(packageDir, { recursive: true });

            scaffoldViteReactPackageFiles(packageDir, "button");

            expect(
                fs.existsSync(path.join(packageDir, "package.json"))
            ).toBe(true);
            expect(
                fs.existsSync(path.join(packageDir, "tsconfig.json"))
            ).toBe(true);
            expect(
                fs.existsSync(path.join(packageDir, "vite.config.js"))
            ).toBe(true);
            expect(
                fs.existsSync(path.join(packageDir, "src", "index.ts"))
            ).toBe(true);

            const pkg = JSON.parse(
                fs.readFileSync(path.join(packageDir, "package.json"), "utf8")
            );
            expect(pkg.name).toBe("button");
        });
    });

    describe("createViteReactPackage", () => {
        it("should_scaffold_and_install_dependencies", () => {
            mockNpmInitWritesPackageJson();

            createViteReactPackage("vite-pkg");

            expect(spawnSyncSafeMock).toHaveBeenCalledWith(
                "npm",
                ["init", "-y"],
                expect.objectContaining({ cwd: path.join(tmpRoot, "vite-pkg") })
            );
            expect(spawnSyncSafeMock).toHaveBeenCalledWith(
                "pnpm",
                expect.arrayContaining(["add", "-D"]),
                expect.any(Object)
            );
            expect(
                fs.existsSync(path.join(tmpRoot, "vite-pkg", "vite.config.js"))
            ).toBe(true);
        });

        it("should_throw_when_directory_already_exists", () => {
            fs.mkdirSync(path.join(tmpRoot, "existing"), { recursive: true });

            expect(() => createViteReactPackage("existing")).toThrow(
                DirectoryAlreadyExistsError
            );
        });
    });

    describe("createWebpackReactPackage", () => {
        it("should_scaffold_webpack_layout_and_install", () => {
            mockNpmInitWritesPackageJson();

            createWebpackReactPackage("webpack-pkg");

            expect(spawnSyncSafeMock).toHaveBeenCalledWith(
                "pnpm",
                ["install"],
                expect.objectContaining({
                    cwd: path.join(tmpRoot, "webpack-pkg"),
                })
            );
            expect(
                fs.existsSync(
                    path.join(tmpRoot, "webpack-pkg", "webpack.config.js")
                )
            ).toBe(true);
        });

        it("should_pass_verbose_flag_to_pnpm_install", () => {
            mockNpmInitWritesPackageJson();

            createWebpackReactPackage("verbose-pkg", true);

            expect(spawnSyncSafeMock).toHaveBeenCalledWith(
                "pnpm",
                ["install", "--loglevel=debug"],
                expect.any(Object)
            );
        });
    });
});
