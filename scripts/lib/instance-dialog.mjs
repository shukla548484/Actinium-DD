import http from "node:http";
import readline from "node:readline";
import { openDialogWindow } from "./port-utils.mjs";

/** @typedef {'restart' | 'open' | 'cancel'} InstanceAction */

/**
 * @param {{
 *   appName: string;
 *   port: number;
 *   url: string;
 *   detected: boolean;
 *   occupant?: string;
 * }} options
 * @returns {Promise<InstanceAction>}
 */
export async function promptRunningInstanceAction(options) {
  const forced = process.env.ACTINIUM_INSTANCE_ACTION;
  if (forced === "restart" || forced === "open" || forced === "cancel") {
    return forced;
  }

  if (process.env.ACTINIUM_SKIP_INSTANCE_PROMPT === "1" || process.env.CI === "true") {
    return "open";
  }

  if (!process.stdin.isTTY && process.env.ACTINIUM_INSTANCE_PROMPT !== "dialog") {
    console.log(
      `${options.appName} appears to be running at ${options.url}. Set ACTINIUM_INSTANCE_ACTION=open|restart to choose.`,
    );
    return "cancel";
  }

  if (process.env.ACTINIUM_INSTANCE_PROMPT === "terminal") {
    return promptTerminal(options);
  }

  try {
    return await promptDialog(options);
  } catch (error) {
    console.warn(
      `[launcher] Dialog unavailable (${error instanceof Error ? error.message : error}); using terminal prompt.`,
    );
    return promptTerminal(options);
  }
}

/**
 * @param {{
 *   appName: string;
 *   port: number;
 *   url: string;
 *   detected: boolean;
 *   occupant?: string;
 * }} options
 * @returns {Promise<InstanceAction>}
 */
function promptTerminal(options) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const hint = options.detected
    ? `${options.appName} is already running at ${options.url}.`
    : `Port ${options.port} is already in use by ${options.occupant ?? "another application"}.`;

  const question = [
    hint,
    "",
    "Choose an option:",
    "  1) Open the running application",
    "  2) Stop it and start a new instance",
    "  3) Cancel",
    "",
    "Enter 1, 2, or 3: ",
  ].join("\n");

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const value = answer.trim();
      if (value === "2") resolve("restart");
      else if (value === "1") resolve("open");
      else resolve("cancel");
    });
  });
}

/**
 * @param {{
 *   appName: string;
 *   port: number;
 *   url: string;
 *   detected: boolean;
 * }} options
 * @returns {Promise<InstanceAction>}
 */
function promptDialog(options) {
  return new Promise((resolve, reject) => {
    /** @type {InstanceAction | null} */
    let settled = false;

    function finish(action) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      server.close(() => resolve(action));
    }

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");

      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(renderDialogHtml(options));
        return;
      }

      if (req.method === "POST" && url.pathname === "/choice") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          /** @type {{ action?: InstanceAction }} */
          let payload = {};
          try {
            payload = JSON.parse(body);
          } catch {
            payload = {};
          }

          const action =
            payload.action === "restart" || payload.action === "open" || payload.action === "cancel"
              ? payload.action
              : "cancel";

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
          finish(action);
        });
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    server.on("error", reject);

    const timeout = setTimeout(() => {
      finish("cancel");
    }, 5 * 60 * 1000);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind dialog server"));
        return;
      }

      const dialogUrl = `http://127.0.0.1:${address.port}/`;
      const opened = openDialogWindow(dialogUrl);
      if (!opened) {
        server.close(() => reject(new Error("Could not open dialog window")));
      }
    });
  });
}

/**
 * @param {{
 *   appName: string;
 *   port: number;
 *   url: string;
 *   detected: boolean;
 * }} options
 */
function renderDialogHtml(options) {
  const statusText = options.detected
    ? `${options.appName} is already running on port ${options.port}.`
    : `Port ${options.port} is in use by ${options.occupant ?? "another application"}.`;

  const payload = JSON.stringify({
    appName: options.appName,
    port: options.port,
    url: options.url,
    statusText,
    detected: options.detected,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${options.appName} — ${options.detected ? "already running" : "port in use"}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #0f172a;
      --panel: #111827;
      --border: rgba(148, 163, 184, 0.25);
      --text: #f8fafc;
      --muted: #94a3b8;
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --secondary: #334155;
      --secondary-hover: #475569;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at top, rgba(37, 99, 235, 0.18), transparent 42%),
        var(--bg);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--text);
      padding: 24px;
    }
    .dialog {
      width: min(100%, 460px);
      background: rgba(17, 24, 39, 0.96);
      border: 1px solid var(--border);
      border-radius: 18px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
      overflow: hidden;
    }
    .header {
      padding: 20px 22px 12px;
      border-bottom: 1px solid var(--border);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #93c5fd;
      margin-bottom: 10px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #22c55e;
      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18);
    }
    h1 {
      margin: 0;
      font-size: 22px;
      line-height: 1.2;
    }
    .body {
      padding: 18px 22px 8px;
    }
    p {
      margin: 0 0 12px;
      color: var(--muted);
      line-height: 1.55;
      font-size: 14px;
    }
    .url {
      display: inline-block;
      margin-top: 4px;
      padding: 8px 10px;
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid var(--border);
      color: #e2e8f0;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      word-break: break-all;
    }
    .actions {
      display: grid;
      gap: 10px;
      padding: 18px 22px 22px;
    }
    button {
      appearance: none;
      border: 0;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 120ms ease, background 120ms ease, opacity 120ms ease;
    }
    button:disabled {
      opacity: 0.65;
      cursor: wait;
    }
    button:not(:disabled):active { transform: scale(0.985); }
    .primary { background: var(--primary); color: white; }
    .primary:not(:disabled):hover { background: var(--primary-hover); }
    .secondary { background: var(--secondary); color: white; }
    .secondary:not(:disabled):hover { background: var(--secondary-hover); }
    .ghost {
      background: transparent;
      color: var(--muted);
      border: 1px solid var(--border);
    }
    .ghost:not(:disabled):hover { color: var(--text); }
    .hint {
      padding: 0 22px 18px;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="title">
    <div class="header">
      <div class="badge"><span class="dot"></span> ${options.detected ? "Instance detected" : "Port occupied"}</div>
      <h1 id="title">${options.appName}</h1>
    </div>
    <div class="body">
      <p id="status">${statusText}</p>
      <div class="url" id="url">${options.url}</div>
    </div>
    <div class="actions">
      <button class="primary" id="openBtn" type="button">Open running application</button>
      <button class="secondary" id="restartBtn" type="button">Stop current and start new</button>
      <button class="ghost" id="cancelBtn" type="button">Cancel</button>
    </div>
    <div class="hint">This launcher dialog closes automatically after you choose an option.</div>
  </div>
  <script>
    const meta = ${payload};
    const buttons = [
      document.getElementById("openBtn"),
      document.getElementById("restartBtn"),
      document.getElementById("cancelBtn"),
    ];

    async function choose(action) {
      for (const button of buttons) button.disabled = true;
      try {
        await fetch("/choice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
      } finally {
        window.close();
      }
    }

    document.getElementById("openBtn").addEventListener("click", () => choose("open"));
    document.getElementById("restartBtn").addEventListener("click", () => choose("restart"));
    document.getElementById("cancelBtn").addEventListener("click", () => choose("cancel"));
  </script>
</body>
</html>`;
}
