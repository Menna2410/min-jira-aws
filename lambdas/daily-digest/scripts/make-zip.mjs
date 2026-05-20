/**
 * Builds function.zip next to daily-digest/package.json for Lambda upload.
 * Run from lambdas/daily-digest: npm install --omit=dev && npm run package
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const dest = join(root, "function.zip");
const nodeModules = join(root, "node_modules");

if (!existsSync(join(root, "handler.cjs"))) {
  console.error("Missing handler.cjs");
  process.exit(1);
}
if (!existsSync(join(root, "index.js"))) {
  console.error("Missing index.js");
  process.exit(1);
}
if (!existsSync(nodeModules)) {
  console.error("Missing node_modules. Run: npm install --omit=dev");
  process.exit(1);
}

const isWin = process.platform === "win32";

if (isWin) {
  const ps = `Compress-Archive -Force -LiteralPath '${join(root, "index.js")}','${join(root, "handler.cjs")}','${join(root, "node_modules")}' -DestinationPath '${dest}'`;
  const r = spawnSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "inherit", shell: false });
  if (r.status !== 0) process.exit(r.status ?? 1);
} else {
  const r = spawnSync("zip", ["-rq", dest, "index.js", "handler.cjs", "node_modules"], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) {
    console.error("`zip` not found. Install zip or create function.zip manually.");
    process.exit(r.status ?? 1);
  }
}

console.log("Wrote:", dest);
