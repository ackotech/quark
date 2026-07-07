const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} */
module.exports = {
    testEnvironment: "node",
    transform: {
        ...tsJestTransformCfg,
    },
    testPathIgnorePatterns: ["/node_modules/", "/dist/"],
    roots: ["<rootDir>/tests"],
    testMatch: ["**/*.test.ts"],
    collectCoverageFrom: [
        "src/**/*.ts",
        "!**/node_modules/**",
        "!**/dist/**",
    ],
    coverageDirectory: "<rootDir>/coverage",
};
