import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    codeSplitting: false,
    lib: {
      entry: resolve(__dirname, "src/pack/index.ts"),
      formats: ["es"],
      fileName: "pack",
    },
  },
});
