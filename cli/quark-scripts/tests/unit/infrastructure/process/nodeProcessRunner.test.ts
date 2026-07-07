import { NodeProcessRunner } from "../../../../src/infrastructure/process/nodeProcessRunner";

describe("NodeProcessRunner", () => {
    it("should_run_command_and_succeed_when_exit_zero", () => {
        const runner = new NodeProcessRunner();
        expect(() =>
            runner.run(process.execPath, ["-e", "process.exit(0)"])
        ).not.toThrow();
    });

    it("should_throw_when_command_exits_nonzero", () => {
        const runner = new NodeProcessRunner();
        expect(() =>
            runner.run(process.execPath, ["-e", "process.exit(2)"])
        ).toThrow(/exit 2/);
    });
});
