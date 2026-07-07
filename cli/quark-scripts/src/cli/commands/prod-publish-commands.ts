import { Command } from "commander";
import { CliCommand } from "../cliCommand";
import { ProdPublishApplication } from "../../app/prod-publish-application";

export class ProdPublishCommand implements CliCommand {
    constructor(private readonly app: ProdPublishApplication) {}

    register(program: Command): void {
        program
            .command("prod-publish")
            .description(
                "Publish changed packages to the production registry based on map.json diff between git tags"
            )
            .option("--tag <tag>", "Target git tag to compare against (defaults to latest)")
            .action(async (options) => {
                await this.app.execute(options.tag);
            });
    }
}
