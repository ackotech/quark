import { Command } from "commander";
import { CliCommand } from "../cliCommand";
import { ReleaseApplication } from "../../app/release-application";

export class ReleaseCommand implements CliCommand {
    constructor(private readonly app: ReleaseApplication) {}

    register(program: Command): void {
        program
            .command("release")
            .description("Run release process")
            .action(async () => {
                await this.app.execute();
            });
    }
}
