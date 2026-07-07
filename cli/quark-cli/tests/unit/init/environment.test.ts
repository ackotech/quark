import * as quarkSecurity from "@quark-hq/quark-security";
import { ensureCliEnvironment } from "../../../src/init/environment";

jest.mock("@quark-hq/quark-security", () => {
    const actual = jest.requireActual<typeof import("@quark-hq/quark-security")>(
        "@quark-hq/quark-security"
    );
    return {
        ...actual,
        spawnSyncSafe: jest.fn(),
    };
});

const spawnSyncSafeMock = jest.mocked(quarkSecurity.spawnSyncSafe);

describe("init/environment", () => {
    let exitSpy: jest.SpyInstance;
    let errSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        exitSpy = jest
            .spyOn(process, "exit")
            .mockImplementation(((code?: number) => {
                throw new Error(`process.exit(${code})`);
            }) as (code?: string | number | null | undefined) => never);
        errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        exitSpy.mockRestore();
        errSpy.mockRestore();
    });

    it("should_complete_when_node_ok_and_tools_present", async () => {
        spawnSyncSafeMock.mockReturnValue({
            status: 0,
            stdout: "9.0.0\n",
            stderr: "",
            pid: 1,
            output: [],
            signal: null,
            error: undefined,
        });

        await expect(ensureCliEnvironment()).resolves.toBeUndefined();
        expect(spawnSyncSafeMock).toHaveBeenCalledWith(
            "pnpm",
            ["--version"],
            expect.objectContaining({ stdio: "ignore" })
        );
        expect(spawnSyncSafeMock).toHaveBeenCalledWith(
            "yalc",
            ["--version"],
            expect.objectContaining({ stdio: "ignore" })
        );
    });

    it("should_exit_when_node_major_below_minimum", async () => {
        const ver = process.version;
        Object.defineProperty(process, "version", {
            configurable: true,
            value: "v16.0.0",
        });

        await expect(ensureCliEnvironment()).rejects.toThrow("process.exit");

        Object.defineProperty(process, "version", {
            configurable: true,
            value: ver,
        });
    });

    it("should_install_pnpm_when_not_on_path", async () => {
        spawnSyncSafeMock
            .mockReturnValueOnce({
                status: 1,
                stdout: "",
                stderr: "",
                pid: 1,
                output: [],
                signal: null,
                error: undefined,
            })
            .mockReturnValue({
                status: 0,
                stdout: "",
                stderr: "",
                pid: 1,
                output: [],
                signal: null,
                error: undefined,
            });

        await expect(ensureCliEnvironment()).resolves.toBeUndefined();

        expect(spawnSyncSafeMock).toHaveBeenCalledWith(
            "npm",
            ["install", "-g", "--loglevel", "error", "pnpm"],
            expect.objectContaining({ stdio: "ignore" })
        );
    });

    it("should_exit_when_global_install_fails", async () => {
        spawnSyncSafeMock.mockImplementation((cmd, args) => {
            if (cmd === "pnpm" && args[0] === "--version") {
                return {
                    status: 1,
                    stdout: "",
                    stderr: "",
                    pid: 1,
                    output: [],
                    signal: null,
                    error: undefined,
                };
            }
            throw new Error("npm install failed");
        });

        await expect(ensureCliEnvironment()).rejects.toThrow("process.exit");
        expect(errSpy).toHaveBeenCalledWith(
            expect.stringContaining("Failed to install pnpm globally")
        );
    });
});
