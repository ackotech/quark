import { Command } from "commander";
import { CliCommand } from "../cliCommand";
import { UnfreezeApplication } from "../../app/unfreeze-application";

export class UnfreezeCommand implements CliCommand {
    constructor(private readonly app: UnfreezeApplication) {}

    register(program: Command): void {
        program
            .command("unfreeze <package-name>")
            .description(
                "Unfreeze a package and restore its dependency versions to workspace:*"
            )
            .action(async (packageName: string) => {
                await this.app.execute(packageName);
            });
    }
}
