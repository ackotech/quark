import fs from "fs";
import os from "os";
import path from "path";
import {
    existsSyncSafe,
    mkdirSyncSafe,
    readFileSyncSafe,
    readdirWithFileTypesSafe,
    writeFileSyncSafe,
} from "../src/fs";

describe("fs-safe helpers", () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), "quark-fs-safe-"));
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it("should_read_write_under_root", () => {
        const f = path.join(tmp, "a.txt");
        writeFileSyncSafe(tmp, f, "hello");
        expect(readFileSyncSafe(tmp, f)).toBe("hello");
    });

    it("should_reject_paths_outside_root", () => {
        const outside = path.join(tmp, "..", "outside-quark-fs-safe");
        expect(() => writeFileSyncSafe(tmp, outside, "x")).toThrow(
            /outside allowed root/i
        );
    });

    it("should_existsSyncSafe", () => {
        const f = path.join(tmp, "b.txt");
        expect(existsSyncSafe(tmp, f)).toBe(false);
        fs.writeFileSync(f, "x");
        expect(existsSyncSafe(tmp, f)).toBe(true);
    });

    it("should_mkdirSyncSafe_recursive", () => {
        const d = path.join(tmp, "a", "b");
        mkdirSyncSafe(tmp, d, { recursive: true });
        expect(fs.statSync(d).isDirectory()).toBe(true);
    });

    it("should_readdirWithFileTypesSafe_under_root", async () => {
        const sub = path.join(tmp, "nest");
        mkdirSyncSafe(tmp, sub, { recursive: true });
        writeFileSyncSafe(tmp, path.join(sub, "x.txt"), "x");
        const entries = await readdirWithFileTypesSafe(tmp, sub);
        const names = entries.map((e) => e.name).sort();
        expect(names).toEqual(["x.txt"]);
    });
});
