#!/usr/bin/env node
/**
 * Launch Actinium-DD desktop: sidecar (Postgres + fleet API) + Tauri app.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const desktop = path.join(root, "desktop");
const isWin = process.platform === "win32";

const sidecar = spawn("node", ["scripts/fleet-sidecar.mjs"], {
  cwd: root,
  env: process.env,
  detached: !isWin,
  stdio: "ignore",
  shell: isWin,
});
if (!isWin) sidecar.unref();

function findDesktopBinary() {
  const bundle = path.join(desktop, "src-tauri", "target", "release", "bundle");
  if (isWin) {
    const msi = path.join(bundle, "msi");
    if (fs.existsSync(msi)) {
      const exe = fs.readdirSync(path.join(bundle, "nsis")).find((f) => f.endsWith(".exe"));
      if (exe) return path.join(bundle, "nsis", exe);
    }
  } else if (process.platform === "darwin") {
    const macos = path.join(bundle, "macos");
    if (fs.existsSync(macos)) {
      const app = fs.readdirSync(macos).find((f) => f.endsWith(".app"));
      if (app) return path.join(macos, app);
    }
  }
  return null;
}

setTimeout(() => {
  const binary = findDesktopBinary();
  if (binary) {
    if (process.platform === "darwin") {
      spawn("open", ["-a", binary], { stdio: "inherit" });
    } else {
      spawn(binary, [], { stdio: "inherit", shell: true });
    }
    console.log(`Launched: ${binary}`);
  } else {
    console.log("Desktop binary not found — starting dev mode (tauri dev)…");
    spawn("npm", ["run", "tauri:dev"], { cwd: desktop, stdio: "inherit", shell: true });
  }
}, 3000);

console.log("Actinium-DD launcher — sidecar running in background.");
console.log("Press Ctrl+C to stop (dev mode only).");
