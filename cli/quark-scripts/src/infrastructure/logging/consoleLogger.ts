import chalk from "chalk";
import { Logger } from "../../ports/logger";

export class ConsoleLogger implements Logger {
  info(message: string): void {
    console.log(chalk.cyan(message));
  }

  success(message: string): void {
    console.log(chalk.green(message));
  }

  warn(message: string): void {
    console.log(chalk.yellow(message));
  }

  error(message: string): void {
    console.error(chalk.red(message));
  }

  debug(message: string): void {
    console.log(chalk.gray(message));
  }
}