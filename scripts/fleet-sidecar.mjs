#!/usr/bin/env node
/**
 * Fleet sidecar — ensure local PostgreSQL is up, start fleet API, keep alive.
 * Used by local-apps launchers (Mac / Windows).
 */
import { spawn, execSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envFile = process.env.FLEET_ENV_FILE ?? path.join(root, "fleet.local.env");
const port = Number(process.env.FLEET_API_PORT ?? 3847);
const host = process.env.FLEET_API_HOST ?? "127.0.0.1";

function loadEnv() {
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function healthCheck(): Promise<boolean> {
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

function startPostgres() {
  const compose = path.join(root, "docker-compose.fleet.yml");
  if (!fs.existsSync(compose)) return;
  try {
    execSync("docker compose -f docker-compose.fleet.yml up -d", {
      cwd: root,
      stdio: "pipe",
    });
    console.log("[sidecar] PostgreSQL container started (docker compose).");
  } catch {
    console.warn("[sidecar] Could not start Docker Postgres — ensure PostgreSQL is running locally.");
  }
}

loadEnv();
startPostgres();

let apiProcess = null;

async function ensureApi() {
  if (await healthCheck()) return;
  if (apiProcess) return;
  console.log(`[sidecar] Starting fleet API on ${host}:${port}…`);
  apiProcess = spawn("npx", ["tsx", "local-api/server.ts"], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  apiProcess.on("exit", (code) => {
    console.error(`[sidecar] Fleet API exited (${code})`);
    apiProcess = null;
  });
}

async function loop() {
  await ensureApi();
  setTimeout(loop, 5000);
}

loop();

process.on("SIGINT", () => {
  apiProcess?.kill("SIGINT");
  process.exit(0);
});
