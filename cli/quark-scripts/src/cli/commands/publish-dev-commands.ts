import { Command } from "commander";
import { CliCommand } from "../cliCommand";
import { PublishDevApplication } from "../../app/publish-dev-application";

export class PublishDevCommand implements CliCommand {
    constructor(private readonly app: PublishDevApplication) {}

    register(program: Command): void {
        program
            .command("publish-dev")
            .description(
                "Publish a package to the dev registry as an alpha version"
            )
            .action(async () => {
                await this.app.execute();
            });
    }
}
