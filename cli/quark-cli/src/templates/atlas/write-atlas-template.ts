import path from "path";
import {
  assertPathInsideRoot,
  mkdirSyncSafe,
  writeFileSafe,
} from "@quark-hq/quark-security";
import { atlasTemplateFiles } from "./atlas-template-manifest.generated";

export function atlasTemplateIsPopulated(): boolean {
  return Object.keys(atlasTemplateFiles).length > 0;
}

/**
 * Materializes the bundled Atlas file tree under `destDir` (absolute path).
 */
export async function writeAtlasTemplateToDirectory(
  destDir: string
): Promise<void> {
  const root = path.resolve(destDir);
  for (const [rel, content] of Object.entries(atlasTemplateFiles)) {
    const dest = assertPathInsideRoot(root, path.resolve(root, rel));
    mkdirSyncSafe(root, path.dirname(dest), { recursive: true });
    await writeFileSafe(root, dest, content);
  }
}
