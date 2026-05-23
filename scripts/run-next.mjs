import net from "node:net";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const mode = process.argv[2];
if (mode !== "dev" && mode !== "start") {
  console.error("Usage: node scripts/run-next.mjs <dev|start>");
  process.exit(1);
}

const startPort = Number(process.env.PORT) || 3000;
const maxAttempts = Number(process.env.PORT_MAX_ATTEMPTS) || 100;

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "0.0.0.0");
  });
}

async function findAvailablePort(fromPort) {
  for (let port = fromPort; port < fromPort + maxAttempts; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
    console.log(`Port ${port} is busy, trying ${port + 1}...`);
  }

  throw new Error(
    `No available port found between ${fromPort} and ${fromPort + maxAttempts - 1}`,
  );
}

const port = await findAvailablePort(startPort);

if (port !== startPort) {
  console.log(`Starting on port ${port} (${startPort} was in use).`);
} else {
  console.log(`Starting on port ${port}.`);
}

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
