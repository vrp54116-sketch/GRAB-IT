/* npm start — build the GRAB IT! UI if dist/ is missing or stale, then
   boot server.mjs, which serves that build as the frontend and runs the
   cloned dropit-backend as the backend on the same port. */

import { existsSync, readdirSync, statSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST_INDEX = path.join(ROOT, "dist", "index.html");
const SKIP = new Set(["node_modules", "dist", ".git"]);

function newestMtime(target) {
  let newest = 0;
  const stat = ((p) => {
    try {
      return statSync(p);
    } catch {
      return null;
    }
  })(target);
  if (!stat) return 0;
  if (!stat.isDirectory()) return stat.mtimeMs;
  for (const entry of readdirSync(target)) {
    if (SKIP.has(entry)) continue;
    newest = Math.max(newest, newestMtime(path.join(target, entry)));
  }
  return newest;
}

function distIsStale() {
  if (!existsSync(DIST_INDEX)) return true;
  const built = statSync(DIST_INDEX).mtimeMs;
  const newestSource = Math.max(
    newestMtime(path.join(ROOT, "src")),
    ...[path.join(ROOT, "index.html"), path.join(ROOT, "vite.config.js")].map((file) =>
      existsSync(file) ? statSync(file).mtimeMs : 0
    )
  );
  return newestSource > built;
}

if (distIsStale()) {
  console.log("  building the GRAB IT! UI (dist/) ...");
  const build = spawnSync("npm", ["run", "build"], { cwd: ROOT, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const child = spawn(process.execPath, [path.join(ROOT, "server.mjs")], {
  cwd: ROOT,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}