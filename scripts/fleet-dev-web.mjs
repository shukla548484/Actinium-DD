#!/usr/bin/env node
/**
 * Dev without Tauri/Rust — desktop UI in browser at http://localhost:1420
 * Fleet API must be running (npm run fleet:api or fleet:sidecar).
 */
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const desktop = path.join(root, "desktop");
const apiPort = Number(process.env.FLEET_API_PORT ?? 3847);
const apiHost = process.env.FLEET_API_HOST ?? "127.0.0.1";
const startPort = Number(process.env.DESKTOP_DEV_PORT ?? 1420);

function httpOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => resolve(res.statusCode === 200));
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

async function findVitePort(from) {
  for (let p = from; p < from + 20; p++) {
    if (await isPortFree(p)) return p;
  }
  throw new Error(`No free port between ${from} and ${from + 19}`);
}

function fleetApiHealthy() {
  return httpOk(`http://${apiHost}:${apiPort}/health`);
}

async function ensureFleetApi() {
  if (await fleetApiHealthy()) {
    console.log(`Fleet API OK at http://${apiHost}:${apiPort}`);
    return null;
  }
  console.log("Starting fleet API…");
  const api = spawn("npx", ["tsx", "local-api/server.ts"], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await fleetApiHealthy()) return api;
  }
  console.error("Fleet API did not start. Check DATABASE_URL / PostgreSQL.");
  api.kill();
  process.exit(1);
}

console.log("Actinium-DD — browser dev (no Tauri/Rust required)\n");

const api = await ensureFleetApi();

// Reuse existing Vite on default port
if (await httpOk(`http://127.0.0.1:${startPort}/`)) {
  console.log(`Desktop UI already running → http://localhost:${startPort}`);
  console.log("(Stop it with: kill $(lsof -t -i :1420))");
  process.exit(0);
}

const vitePort = await findVitePort(startPort);
if (vitePort !== startPort) {
  console.log(`Port ${startPort} busy — using ${vitePort} instead.`);
}

console.log(`Starting Vite → http://localhost:${vitePort}\n`);

const vite = spawn(
  "npx",
  ["vite", "--port", String(vitePort), "--strictPort", "false"],
  {
    cwd: desktop,
    stdio: "inherit",
    env: { ...process.env, FLEET_WEB_DEV: "1" },
    shell: process.platform === "win32",
  },
);

vite.on("exit", (code) => {
  api?.kill("SIGINT");
  process.exit(code ?? 0);
});

process.on("SIGINT", () => {
  vite.kill("SIGINT");
  api?.kill("SIGINT");
  process.exit(0);
});
