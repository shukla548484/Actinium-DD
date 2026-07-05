import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promptRunningInstanceAction } from "./lib/instance-dialog.mjs";
import {
  ACTINIUM_APP_ID,
  findAvailablePort,
  isPortAvailable,
  killProcessesOnPort,
  openBrowserUrl,
  probeAppAtPort,
  waitForPortFree,
} from "./lib/port-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const mode = process.argv[2];
if (mode !== "dev" && mode !== "start") {
  console.error("Usage: node scripts/run-next.mjs <dev|start>");
  process.exit(1);
}

const startPort = Number(process.env.PORT) || 3000;
const appName = process.env.ACTINIUM_APP_NAME || "Actinium-DD";

function startNext(port) {
  console.log(`Starting ${appName} on http://localhost:${port}`);

  const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
  const args = [nextBin, mode, "-p", String(port), ...process.argv.slice(3)];

  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  child.on("error", (err) => {
    console.error(err);
    process.exit(1);
  });

  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}

async function resolveStartupPort() {
  if (await isPortAvailable(startPort)) {
    return startPort;
  }

  const probe = await probeAppAtPort(startPort, { appId: ACTINIUM_APP_ID, appName });

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

  const altPort = await findAvailablePort(startPort + 1);
  if (!altPort) {
    console.error(`No free port found near ${startPort}. Stop the other application or set PORT.`);
    process.exit(1);
  }

  console.log(`Starting ${appName} on port ${altPort} instead.`);
  return altPort;
}

const port = await resolveStartupPort();
startNext(port);
