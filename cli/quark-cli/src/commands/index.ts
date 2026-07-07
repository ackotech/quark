import { Command } from "commander";
import chalk from "chalk";
import prompts from "prompts";
import path from "path";
// Import your string templates
import { addPackage, localPublish, removePackage } from "../yalc";
import { Init } from "../init";
import {
    assertValidNpmPackageName,
    existsSyncSafe,
    resolveRelativeNameUnderRoot,
    resolveUnderWorkspaceRoot,
    rmSafe,
    rmSyncSafe,
} from "@quark-hq/quark-security";
import { createViteReactPackage, createWebpackReactPackage } from "../utils/create-new-package";

import { DirectoryAlreadyExistsError } from "../errors/directory-errors";

export const initCommand = new Command("new")
    .arguments("<project-name>")
    .description("Initialize a new Quark project")
    .action(async (projectName: string) => {
        const init = new Init(projectName);
        await init.main();
    });

export const createCommand = new Command("create")
  .arguments("<package-name>")
  .description("Scaffold a new React package")
  .action(async (packageName: string) => {
    assertValidNpmPackageName(packageName, "package name");
    const targetDir = resolveRelativeNameUnderRoot(process.cwd(), packageName);
    let createdByThisRun = false;

    if (existsSyncSafe(process.cwd(), targetDir)) {
      console.error(chalk.red(`Folder "${packageName}" already exists.`));
      process.exit(1);
    }

    // 👇 Ask build type using prompts
    const { buildTool } = await prompts({
      type: "select",
      name: "buildTool",
      message: "Select build setup",
      initial: 1,
      choices: [
        { title: "Vite", value: "vite" },
        { title: "Webpack", value: "webpack" },
      ],
    });

    // Handle Ctrl+C / abort
    if (!buildTool) {
      console.log(chalk.yellow("Operation cancelled"));
      process.exit(0);
    }
    try {
      createdByThisRun = true;
      switch(buildTool) {
        case "vite":
          createViteReactPackage(packageName);
          break;
        case "webpack":
          createWebpackReactPackage(packageName);
          break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to scaffold package";
      console.error(chalk.red(message));

      if (error instanceof DirectoryAlreadyExistsError) {
        process.exit(1);
      }

      if (createdByThisRun && existsSyncSafe(process.cwd(), targetDir)) {
        try {
          console.log(chalk.yellow(`Cleanup: removing "${packageName}" after failure...`));
          rmSyncSafe(process.cwd(), targetDir);
        } catch (cleanupError) {
          const cleanupMessage = cleanupError instanceof Error
            ? cleanupError.message
            : "Unknown cleanup error";
          console.error(chalk.red(`Failed to clean up "${packageName}": ${cleanupMessage}`));
        }
      }

      process.exit(1);
    }
  });


export const publish = new Command("publish")
    .arguments("<package-name>")
    .description("Publish package to local Yalc registry")
    .option("--push", "Push package to linked projects after publish")
    .action((packageName: string, options: { push?: boolean }) => {
        assertValidNpmPackageName(packageName, "package name");
        localPublish(packageName, options.push ?? false);
    });

export const link = new Command("link")
    .arguments("<package-name>")
    .description("Publish package to local registry via yalc and link it to current project")
    .action(async (packageName: string) => {
        addPackage(packageName);
    });




export const remove = new Command("remove")
    .arguments("[packageName]")
    .description("Remove a package linked via yalc or use --all to remove all")
    .option("--all", "Remove all yalc-linked packages")
    .action((packageName: string | undefined, options: { all?: boolean }) => {
        if (options.all && packageName) {
            console.error("❌ Cannot pass a package name when using --all");
            process.exit(1);
        }

        if (!options.all && !packageName) {
            console.error("❌ You must pass a package name or use --all");
            process.exit(1);
        }

        removePackage(packageName ?? "", options.all ?? false);
    });

export const addAtlasCommand = new Command("add-atlas")
    .argument("[targetDir]", "Directory to create under the current workspace (default: atlas)", "atlas")
    .description("Copy the bundled Atlas (Next.js) app from this CLI package into your workspace")
    .option("--force", "Overwrite an existing target directory")
    .action(async (targetDir: string, options: { force?: boolean }) => {
        const { atlasTemplateIsPopulated, writeAtlasTemplateToDirectory } =
            await import("../templates/atlas/write-atlas-template");

        if (!atlasTemplateIsPopulated()) {
            console.error(
                chalk.red(
                    `Bundled Atlas template is empty. Run \`pnpm run generate-atlas-manifest\` in @acko/quark (or \`pnpm build\`, which runs prebuild) with the monorepo "atlas" app present.`
                )
            );
            process.exit(1);
        }

        const cwd = process.cwd();
        let dest: string;
        try {
            dest = resolveUnderWorkspaceRoot(cwd, targetDir);
        } catch (e) {
            console.error(chalk.red(e instanceof Error ? e.message : String(e)));
            process.exit(1);
        }

        const destExists = existsSyncSafe(cwd, path.relative(cwd, dest));
        if (destExists && !options.force) {
            console.error(
                chalk.red(
                    `Target "${targetDir}" already exists. Pass --force to replace it, or choose another path.`
                )
            );
            process.exit(1);
        }

        if (destExists && options.force) {
            await rmSafe(cwd, path.relative(cwd, dest), {
                recursive: true,
                force: true,
            });
        }

        await writeAtlasTemplateToDirectory(dest);
        console.log(chalk.green(`Atlas copied to ${path.relative(cwd, dest) || "."}`));
    });
