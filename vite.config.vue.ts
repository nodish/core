import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import { libInjectCss } from "vite-plugin-lib-inject-css";

export default defineConfig({
  plugins: [
    vue(),
    libInjectCss(),
    dts({
      tsconfigPath: "./tsconfig.lib.json",
      rollupTypes: false,
      entryRoot: "src",
      outDir: "dist",
      include: ["src/vue/index.ts", "src/**/*.ts", "src/**/*.vue"],
      skipDiagnostics: true,
    }),
  ],
  build: {
    emptyOutDir: false,
    // Required for vite-plugin-lib-inject-css (skipped when false).
    cssCodeSplit: true,
    codeSplitting: false,
    lib: {
      entry: resolve(__dirname, "src/vue/index.ts"),
      formats: ["es"],
      fileName: "vue",
    },
    rollupOptions: {
      external: ["vue"],
      output: {
        assetFileNames: (asset) =>
          asset.names?.some((n) => n.endsWith(".css")) ? "vue.css" : "[name][extname]",
      },
    },
  },
});
