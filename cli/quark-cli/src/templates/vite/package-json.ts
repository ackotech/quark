import {dedent} from "ts-dedent"
export const packageJson = (name: string) => dedent(`{
  "name": "${name}",
  "version": "1.0.0",
  "description": "Reusable React component/library built with Vite",
  "license": "MIT",

  "type": "module",

  "main": "./dist/index.cjs",
  "module": "./dist/index.esm.js",
  "types": "./dist/index.d.ts",

  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.esm.js",
      "require": "./dist/index.cjs"
    },
    "./style.css": "./dist/main.css"
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
    "dev": "vite",
    "build": "vite build",
    "build:watch": "vite build --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rimraf dist"
  },

  "peerDependencies": {
    "react": ">=17",
    "react-dom": ">=17"
  },

  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "vite-plugin-dts": "^3.7.0",

    "typescript": "^5.3.0",
    "rimraf": "^5.0.5"
  }
}`)