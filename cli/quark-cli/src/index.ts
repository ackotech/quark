#!/usr/bin/env node
import { Command } from "commander";
import {
    addAtlasCommand,
    createCommand,
    initCommand,
    link,
    publish,
    remove,
} from "./commands";

const pkg = require("../package.json");
const program = new Command();

program
  .name("quark")
  .version(pkg.version)
  .addCommand(initCommand)
  .addCommand(createCommand)
  .addCommand(publish)
  .addCommand(link)
  .addCommand(remove)
  .addCommand(addAtlasCommand)

program.parse();
