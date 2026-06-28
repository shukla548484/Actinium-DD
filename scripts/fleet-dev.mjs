#!/usr/bin/env node
/**
 * Dev workflow: fleet local API + Tauri desktop (Vite).
 * Reuses an existing fleet API if already listening on FLEET_API_PORT.
 * Falls back to browser dev if Rust/Cargo is not installed.
 */
import { spawn, execSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const port = Number(process.env.FLEET_API_PORT ?? 3847);
const host = process.env.FLEET_API_HOST ?? "127.0.0.1";

const cargoBin = path.join(process.env.HOME ?? "", ".cargo", "bin");
if (cargoBin && !process.env.PATH?.includes(cargoBin)) {
  process.env.PATH = `${cargoBin}${path.delimiter}${process.env.PATH ?? ""}`;
}

function cargoAvailable() {
  try {
    execSync("cargo --version", { stdio: "ignore", env: process.env });
    return true;
  } catch {
    return false;
  }
}

function fleetApiHealthy() {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function run(cmd, args, cwd, name) {
  const child = spawn(cmd, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with ${code}`);
      process.exit(code ?? 1);
    }
  });
  return child;
}

console.log("Starting fleet local API + Tauri desktop…");
console.log("Ensure PostgreSQL is running (docker compose -f docker-compose.fleet.yml up -d)");

let api = null;
let startedApi = false;

if (await fleetApiHealthy()) {
  console.log(`Fleet API already running at http://${host}:${port} — skipping start.`);
} else {
  api = run("npx", ["tsx", "local-api/server.ts"], root, "fleet-api");
  startedApi = true;

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await fleetApiHealthy()) break;
  }
}

const delay = startedApi ? 1500 : 500;

if (!cargoAvailable()) {
  console.warn("\nRust/Cargo not found — use browser dev instead:");
  console.warn("  npm run fleet:dev:web   → http://localhost:1420\n");
  console.warn("Install Rust for native desktop: curl -sSf https://sh.rustup.rs | sh\n");
  setTimeout(() => {
    run("node", ["scripts/fleet-dev-web.mjs"], root, "vite");
  }, delay);
} else {
  setTimeout(() => {
    run("npm", ["run", "tauri:dev"], path.join(root, "desktop"), "tauri");
  }, delay);
}

process.on("SIGINT", () => {
  if (startedApi && api) api.kill("SIGINT");
  process.exit(0);
});
