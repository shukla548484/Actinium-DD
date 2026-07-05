#!/usr/bin/env node
/**
 * Dev without Tauri/Rust — desktop UI in browser at http://localhost:1420
 * Fleet API must be running (npm run fleet:api or fleet:sidecar).
 */
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promptRunningInstanceAction } from "./lib/instance-dialog.mjs";
import {
  findAvailablePort,
  isPortAvailable,
  killProcessesOnPort,
  openBrowserUrl,
  probeAppAtPort,
  waitForPortFree,
} from "./lib/port-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const desktop = path.join(root, "desktop");
const apiPort = Number(process.env.FLEET_API_PORT ?? 3847);
const apiHost = process.env.FLEET_API_HOST ?? "127.0.0.1";
const startPort = Number(process.env.DESKTOP_DEV_PORT ?? 1420);
const appName = process.env.ACTINIUM_APP_NAME || "Actinium-DD Desktop";
const desktopAppId = "actinium-dd-desktop";

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

function startVite(port) {
  console.log(`Starting ${appName} → http://localhost:${port}\n`);

  const vite = spawn(
    "npx",
    ["vite", "--port", String(port), "--strictPort", "true"],
    {
      cwd: desktop,
      stdio: "inherit",
      env: { ...process.env, FLEET_WEB_DEV: "1" },
      shell: process.platform === "win32",
    },
  );

  vite.on("exit", (code) => {
    apiRef?.kill("SIGINT");
    process.exit(code ?? 0);
  });

  process.on("SIGINT", () => {
    vite.kill("SIGINT");
    apiRef?.kill("SIGINT");
    process.exit(0);
  });
}

console.log("Actinium-DD — browser dev (no Tauri/Rust required)\n");

/** @type {import('node:child_process').ChildProcess | null} */
let apiRef = null;
apiRef = await ensureFleetApi();

async function resolveStartupPort() {
  if (await isPortAvailable(startPort, "127.0.0.1")) {
    return startPort;
  }

  const probe = await probeAppAtPort(startPort, {
    appId: desktopAppId,
    appName,
    identityPath: "/actinium-app-identity.json",
  });

  if (probe.isActinium) {
    const action = await promptRunningInstanceAction({
      appName,
      port: startPort,
      url: probe.url,
      detected: true,
      occupant: probe.occupant,
    });

    if (action === "open") {
      console.log(`Opening ${probe.url}`);
      openBrowserUrl(probe.url);
      process.exit(0);
    }

    if (action === "cancel") {
      console.log("Startup cancelled.");
      process.exit(0);
    }

    console.log(`Stopping ${appName} on port ${startPort}…`);
    await killProcessesOnPort(startPort);

    const ready = await waitForPortFree(startPort);
    if (!ready) {
      console.error(`Port ${startPort} is still in use. Close the other instance manually and retry.`);
      process.exit(1);
    }

    return startPort;
  }

  const occupantLabel = probe.running
    ? `${probe.occupant} (HTTP server responded but is not ${appName})`
    : probe.occupant;

  console.log(`Port ${startPort} is in use by ${occupantLabel}.`);

  const altPort = await findAvailablePort(startPort + 1, { host: "127.0.0.1" });
  if (!altPort) {
    console.error(`No free port found near ${startPort}. Stop the other application or set DESKTOP_DEV_PORT.`);
    process.exit(1);
  }

  console.log(`Starting ${appName} on port ${altPort} instead.`);
  return altPort;
}

const port = await resolveStartupPort();
startVite(port);
