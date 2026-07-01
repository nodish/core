import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(root, "local"),
  plugins: [vue()],
  resolve: {
    alias: {
      "@nodish/core": resolve(root, "src/vue/index.ts"),
    },
  },
  server: {
    fs: {
      allow: [root],
    },
  },
});
