import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import { libInjectCss } from "vite-plugin-lib-inject-css";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    vue(),
    libInjectCss(),
    dts({
      tsconfigPath: "./tsconfig.lib.json",
      rollupTypes: true,
      entryRoot: "src",
      outDir: "dist",
      include: ["src/vue/index.ts", "src/**/*.ts", "src/**/*.vue"],
    }),
  ],
  build: {
    emptyOutDir: true,
    // Required for vite-plugin-lib-inject-css (skipped when false).
    cssCodeSplit: true,
    lib: {
      entry: resolve(root, "src/vue/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["vue"],
      output: {
        assetFileNames: (asset) =>
          asset.names?.some((n) => n.endsWith(".css"))
            ? "index.css"
            : "[name][extname]",
      },
    },
  },
});
