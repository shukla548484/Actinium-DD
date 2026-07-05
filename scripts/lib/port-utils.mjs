import { execSync } from "node:child_process";
import http from "node:http";
import net from "node:net";

export const ACTINIUM_APP_ID = "actinium-dd";

export function isPortAvailable(port, host = "0.0.0.0") {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

export function getListeningPids(port) {
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano | findstr :${port}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const pids = new Set();
      for (const line of output.split(/\r?\n/)) {
        if (!line.includes("LISTENING")) continue;
        const parts = line.trim().split(/\s+/);
        const pid = Number(parts.at(-1));
        if (Number.isInteger(pid) && pid > 0) pids.add(pid);
      }
      return [...pids];
    }

    const output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output
      .trim()
      .split(/\s+/)
      .map((value) => Number(value))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

/** Best-effort process name(s) listening on a port — for launcher diagnostics. */
export function getPortOccupantDescription(port) {
  const pids = getListeningPids(port);
  if (pids.length === 0) return "an unknown process";

  const names = pids.map((pid) => {
    try {
      if (process.platform === "win32") {
        const output = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });
        const match = output.match(/"([^"]+)"/);
        return match?.[1] ?? `PID ${pid}`;
      }

      const command = execSync(`ps -p ${pid} -o comm=`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();

      if (command) return command;

      const args = execSync(`ps -p ${pid} -o args=`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();

      return args ? args.split(/\s+/).slice(0, 3).join(" ") : `PID ${pid}`;
    } catch {
      return `PID ${pid}`;
    }
  });

  return [...new Set(names)].join(", ");
}

export async function killProcessesOnPort(port) {
  const pids = getListeningPids(port);
  if (pids.length === 0) return false;

  for (const pid of pids) {
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
      } else {
        process.kill(pid, "SIGTERM");
      }
    } catch {
      // Process may already have exited.
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 600));

  if (process.platform !== "win32") {
    const remaining = getListeningPids(port);
    for (const pid of remaining) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // ignore
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return true;
}

/**
 * @param {number} port
 * @param {{
 *   appId?: string;
 *   appName?: string;
 * }} [options]
 * @returns {Promise<{
 *   running: boolean;
 *   isActinium: boolean;
 *   url: string;
 *   statusCode: number;
 *   occupant: string;
 *   identity?: { appId: string; appName: string; version?: string };
 * }>}
 */
export function probeAppAtPort(port, options = {}) {
  const appId = options.appId ?? ACTINIUM_APP_ID;
  const identityPath = options.identityPath ?? "/api/app-identity";
  const url = `http://localhost:${port}`;
  const occupant = getPortOccupantDescription(port);

  return new Promise((resolve) => {
    const req = http.get(
      {
        host: "127.0.0.1",
        port,
        path: identityPath,
        timeout: 2500,
        headers: { Accept: "application/json" },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
          if (body.length > 8_192) req.destroy();
        });
        res.on("end", () => {
          /** @type {{ appId?: string; appName?: string; version?: string } | null} */
          let identity = null;
          let isActinium = false;

          if (res.statusCode === 200) {
            try {
              identity = JSON.parse(body);
              isActinium = identity?.appId === appId;
            } catch {
              identity = null;
            }
          }

          resolve({
            running: true,
            isActinium,
            url,
            statusCode: res.statusCode ?? 0,
            occupant,
            identity: identity ?? undefined,
          });
        });
      },
    );

    req.on("timeout", () => {
      req.destroy();
      resolve({
        running: false,
        isActinium: false,
        url,
        statusCode: 0,
        occupant,
      });
    });

    req.on("error", () => {
      resolve({
        running: false,
        isActinium: false,
        url,
        statusCode: 0,
        occupant,
      });
    });
  });
}

export async function findAvailablePort(startPort, { host = "0.0.0.0", maxAttempts = 50 } = {}) {
  for (let offset = 0; offset < maxAttempts; offset++) {
    const port = startPort + offset;
    if (await isPortAvailable(port, host)) return port;
  }
  return null;
}

export function openBrowserUrl(url) {
  try {
    if (process.platform === "darwin") {
      execSync(`open ${JSON.stringify(url)}`, { stdio: "ignore" });
      return true;
    }
    if (process.platform === "win32") {
      execSync(`start "" ${JSON.stringify(url)}`, { stdio: "ignore", shell: true });
      return true;
    }
    execSync(`xdg-open ${JSON.stringify(url)}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Open a small standalone window when possible; otherwise use the default browser. */
export function openDialogWindow(url) {
  try {
    if (process.platform === "darwin") {
      for (const app of ["Google Chrome", "Microsoft Edge", "Brave Browser", "Chromium"]) {
        try {
          execSync(
            `open -na ${JSON.stringify(app)} --args --app=${JSON.stringify(url)} --window-size=520,420`,
            { stdio: "ignore" },
          );
          return true;
        } catch {
          // try next browser
        }
      }
    }

    if (process.platform === "win32") {
      for (const cmd of [
        `start msedge --app=${JSON.stringify(url)}`,
        `start chrome --app=${JSON.stringify(url)}`,
      ]) {
        try {
          execSync(cmd, { stdio: "ignore", shell: true });
          return true;
        } catch {
          // try next browser
        }
      }
    }
  } catch {
    // fall through
  }

  return openBrowserUrl(url);
}

export async function waitForPortFree(port, attempts = 20) {
  for (let i = 0; i < attempts; i++) {
    if (await isPortAvailable(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}
