export const viteConfig = `import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "automatic",
      jsxImportSource: "react",
    }),
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
      exclude: ["**/*.stories.*", "**/*.test.*", "**/*.spec.*"],
    }),
  ],

  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "<%= name %>",
      formats: ["es", "cjs"],
      fileName: (format) =>
        format === "cjs" ? "index.cjs" : "index.esm.js",
    },

    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        /^react\\//,
        "preact",
        "preact/compat",
        "preact/jsx-runtime",
        "preact/hooks",
        /^preact\\//,
      ],

      output: {
        exports: "named",
        interop: "auto",
        
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },

        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "main.css";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },

    cssCodeSplit: false,
    sourcemap: true,
    minify: false,
    target: "es2015",
    emptyOutDir: true,
  },

  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },

  css: {
    modules: false,
    preprocessorOptions: {
      scss: {},
      sass: {},
    },
  },

  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
});
`;

