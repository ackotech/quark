#!/usr/bin/env node

import path from "path";
import dotenv from "dotenv";
import { createProgram } from "./cli/program";
import { formatErrorMessage, shouldLogErrorStack } from "@quark-hq/quark-security";
import { UnfreezeBlockedByFrozenDependenciesError } from "./errors/unfreeze-blocked-error";

dotenv.config({
    path: path.resolve(process.cwd(), ".env"),
});

async function bootstrap(): Promise<void> {
  try {
    const program = createProgram();
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof UnfreezeBlockedByFrozenDependenciesError) {
      console.error(error.renderCli());
      process.exit(1);
    }
    console.error("Fatal error:", formatErrorMessage(error));
    if (shouldLogErrorStack() && error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

bootstrap();