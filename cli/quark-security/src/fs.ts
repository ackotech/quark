import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { assertPathInsideRoot } from "./paths";

function toSafePath(root: string, candidate: string): string {
    return assertPathInsideRoot(root, path.resolve(candidate));
}

export function existsSyncSafe(root: string, candidate: string): boolean {
    // bearer:disable javascript_lang_non_literal_fs_filename
    return fs.existsSync(toSafePath(root, candidate));
}

export function mkdirSyncSafe(
    root: string,
    candidate: string,
    options?: fs.MakeDirectoryOptions
): void {
    // bearer:disable javascript_lang_non_literal_fs_filename
    fs.mkdirSync(toSafePath(root, candidate), options);
}

export function readFileSyncSafe(
    root: string,
    candidate: string,
    encoding: BufferEncoding = "utf8"
): string {
    // bearer:disable javascript_lang_non_literal_fs_filename
    return fs.readFileSync(toSafePath(root, candidate), encoding);
}

type WriteFileSyncOptions = {
    encoding?: BufferEncoding;
    mode?: number;
    flag?: string;
};

export function writeFileSyncSafe(
    root: string,
    candidate: string,
    data: string | NodeJS.ArrayBufferView,
    options?: BufferEncoding | WriteFileSyncOptions
): void {
    const safe = toSafePath(root, candidate);
    const resolved = typeof options === "string" || options === undefined
        ? { encoding: options ?? "utf8" }
        : options;
    // bearer:disable javascript_lang_non_literal_fs_filename
    fs.writeFileSync(safe, data, resolved);
}

export function rmSyncSafe(
    root: string,
    candidate: string,
    options?: fs.RmOptions
): void {
    // bearer:disable javascript_lang_non_literal_fs_filename
    fs.rmSync(toSafePath(root, candidate), options);
}


export async function readFileSafe(
    root: string,
    candidate: string
): Promise<string> {
    // bearer:disable javascript_lang_non_literal_fs_filename
    return fsp.readFile(toSafePath(root, candidate), "utf8");
}

export async function readdirWithFileTypesSafe(
    root: string,
    candidate: string
): Promise<fs.Dirent[]> {
    // bearer:disable javascript_lang_non_literal_fs_filename
    return fsp.readdir(toSafePath(root, candidate), { withFileTypes: true });
}

export async function writeFileSafe(
    root: string,
    candidate: string,
    data: string
): Promise<void> {
    // bearer:disable javascript_lang_non_literal_fs_filename
    await fsp.writeFile(toSafePath(root, candidate), data, "utf8");
}

export async function unlinkSafe(
    root: string,
    candidate: string
): Promise<void> {
    // bearer:disable javascript_lang_non_literal_fs_filename
    await fsp.unlink(toSafePath(root, candidate));
}

export async function rmSafe(
    root: string,
    candidate: string,
    options?: fs.RmOptions
): Promise<void> {
    // bearer:disable javascript_lang_non_literal_fs_filename
    await fsp.rm(toSafePath(root, candidate), options);
}
