import { cpSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

if (process.env.INIT_CWD && process.env.INIT_CWD !== root) {
  process.exit(0);
}

const devDir = resolve(root, "dev");
const localDir = resolve(root, "local");

if (!existsSync(devDir)) {
  console.warn("[preinstall] dev/ not found — skipping copy to local/");
  process.exit(0);
}

if (existsSync(localDir)) {
  console.log("[preinstall] local/ already exists — skipping copy from dev/");
  process.exit(0);
}

cpSync(devDir, localDir, { recursive: true });
console.log("[preinstall] Copied dev/ → local/");
