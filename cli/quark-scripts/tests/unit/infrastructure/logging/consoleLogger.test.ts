import chalk from "chalk";
import { ConsoleLogger } from "../../../../src/infrastructure/logging/consoleLogger";

describe("ConsoleLogger", () => {
    let logSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
    });

    it("should_log_info_with_cyan", () => {
        const logger = new ConsoleLogger();
        logger.info("hello");
        expect(logSpy).toHaveBeenCalledWith(chalk.cyan("hello"));
    });

    it("should_log_success_with_green", () => {
        const logger = new ConsoleLogger();
        logger.success("ok");
        expect(logSpy).toHaveBeenCalledWith(chalk.green("ok"));
    });

    it("should_log_warn_with_yellow", () => {
        const logger = new ConsoleLogger();
        logger.warn("careful");
        expect(logSpy).toHaveBeenCalledWith(chalk.yellow("careful"));
    });

    it("should_log_error_with_red_on_stderr", () => {
        const logger = new ConsoleLogger();
        logger.error("bad");
        expect(errorSpy).toHaveBeenCalledWith(chalk.red("bad"));
    });

    it("should_log_debug_with_gray", () => {
        const logger = new ConsoleLogger();
        logger.debug("dbg");
        expect(logSpy).toHaveBeenCalledWith(chalk.gray("dbg"));
    });
});
