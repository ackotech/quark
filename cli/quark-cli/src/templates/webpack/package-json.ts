import {dedent} from "ts-dedent"
export const packageJson = (name: string) => dedent(`{
  "name": "${name}",
  "version": "1.0.0",
  "description": "Reusable UI / library package built with Webpack and TypeScript",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.esm.js",
  "module": "./dist/index.esm.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.esm.js"
    }
  },
  "files": [
    "dist"
  ],
  "sideEffects": [
    "*.css",
    "*.scss",
    "*.sass"
  ],
  "scripts": {
    "clean": "rimraf dist",
    "build": "webpack ",
    "build:watch": "webpack --watch",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": ">=17",
    "react-dom": ">=17"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "webpack": "^5.90.0",
    "webpack-cli": "^5.1.4",
    "ts-loader": "^9.5.1",
    "mini-css-extract-plugin": "^2.7.7",
    "clean-webpack-plugin": "^4.0.0",
    "css-loader": "^6.10.0",
    "sass": "^1.69.0",
    "sass-loader": "^13.3.2",
    "rimraf": "^5.0.5"
  }
}`)