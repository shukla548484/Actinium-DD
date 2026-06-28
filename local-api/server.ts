/**
 * Local fleet API — Tauri desktop talks to local PostgreSQL via this server.
 * Run: npm run fleet:api
 */
import http from "node:http";
import { URL } from "node:url";
import {
  createFleetProject,
  getFleetProjectSnapshot,
  listFleetProjects,
  saveFleetProjectSnapshot,
  softDeleteFleetProject,
} from "../lib/db/fleetProjects";
import { getSyncStatus } from "../lib/sync/status";
import { buildHybridComparison } from "../lib/tender/buildHybridComparison";
import type { CompareAppSnapshot } from "../lib/desktop/snapshot";

const PORT = Number(process.env.FLEET_API_PORT ?? 3847);
const HOST = process.env.FLEET_API_HOST ?? "127.0.0.1";

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
) {
  if (method === "OPTIONS") {
    send(res, 204, {});
    return;
  }

  if (pathname === "/health" && method === "GET") {
    send(res, 200, { ok: true, service: "fleet-local-api" });
    return;
  }

  if (pathname === "/sync/status" && method === "GET") {
    const status = await getSyncStatus();
    send(res, 200, status);
    return;
  }

  if (pathname === "/projects" && method === "GET") {
    const vesselId = process.env.VESSEL_ID?.trim();
    const projects = await listFleetProjects(vesselId || undefined);
    send(res, 200, { projects });
    return;
  }

  if (pathname === "/projects" && method === "POST") {
    const body = JSON.parse(await readBody(req)) as {
      name?: string;
      vesselName?: string;
      vesselId?: string;
    };
    if (!body.name?.trim()) {
      send(res, 400, { error: "Project name is required." });
      return;
    }
    const project = await createFleetProject({
      name: body.name,
      vesselName: body.vesselName,
      vesselId: body.vesselId,
    });
    send(res, 201, { project });
    return;
  }

  const projectMatch = pathname.match(/^\/projects\/([^/]+)(?:\/(snapshot|comparison))?$/);
  if (projectMatch) {
    const projectId = projectMatch[1]!;

    if (pathname.endsWith("/comparison") && method === "GET") {
      const comparison = await buildHybridComparison(projectId);
      if (!comparison) {
        send(res, 404, { error: "Project not found." });
        return;
      }
      send(res, 200, { comparison });
      return;
    }

    if (pathname.endsWith("/snapshot") && method === "GET") {
      const data = await getFleetProjectSnapshot(projectId);
      if (!data) {
        send(res, 404, { error: "Project not found." });
        return;
      }
      send(res, 200, data);
      return;
    }

    if (pathname.endsWith("/snapshot") && method === "PUT") {
      const body = JSON.parse(await readBody(req)) as { snapshot?: CompareAppSnapshot };
      if (!body.snapshot) {
        send(res, 400, { error: "snapshot is required." });
        return;
      }
      await saveFleetProjectSnapshot(projectId, body.snapshot);
      send(res, 200, { ok: true });
      return;
    }

    if (!pathname.includes("/snapshot") && method === "DELETE") {
      const ok = await softDeleteFleetProject(projectId);
      send(res, ok ? 200 : 404, { ok });
      return;
    }
  }

  send(res, 404, { error: "Not found." });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${HOST}`);
    await handle(req, res, url.pathname, req.method ?? "GET");
  } catch (e) {
    console.error("[fleet-api]", e);
    send(res, 500, { error: e instanceof Error ? e.message : "Internal error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Fleet local API http://${HOST}:${PORT}`);
});

server.on("error", (err) => {
  if (err && "code" in err && err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the other fleet API or run: npm run fleet:dev (reuses existing API)`,
    );
    process.exit(1);
  }
  throw err;
});
