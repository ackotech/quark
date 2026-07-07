import fs from "fs";
import path from "path";
import { QuarkConfig } from "../../ports/config";

const DEFAULT_CONFIG: QuarkConfig = {
    release: {
        masterBranch: "main",
        autoCommit: false,
        autoBump: true,
        freeze: true,
    },
    publish: {
        node: {
            registryUrl: "",
            scope: "",
        },
        maven: {
            repositoryUrl: "",
            repositoryId: "",
        },
    },
};

export class QuarkConfigProvider {
    getConfig(): QuarkConfig {
        const configPath = path.resolve(process.cwd(), "quark-config.json");

        if (!fs.existsSync(configPath)) {
            return DEFAULT_CONFIG;
        }

        const raw = fs.readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(raw) as Partial<QuarkConfig>;

        return {
            release: { ...DEFAULT_CONFIG.release, ...parsed.release },
            publish: {
                node: {
                    ...DEFAULT_CONFIG.publish!.node!,
                    ...parsed.publish?.node,
                },
                maven: {
                    ...DEFAULT_CONFIG.publish!.maven!,
                    ...parsed.publish?.maven,
                },
            },
        };
    }
}
