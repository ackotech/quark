import { Command } from "commander";
import { CliContainer } from "./cli-containers";

const pkg = require("../../package.json");

export function createProgram(): Command {
  const program = new Command();

  program
    .name("quark")
    .description("Polyglot build & release orchestration tool")
    .version(pkg.version);

  const container = CliContainer.create();
  container.register(program);

  return program;
}
