import type { CompareAppSnapshot } from "@/lib/desktop/snapshot";
import type { Project } from "@/lib/tender/types";
import type { SyncStatus } from "@/lib/sync/status";

const BASE = import.meta.env.VITE_FLEET_API_URL ?? "http://127.0.0.1:3847";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return data;
}

export async function checkFleetApiHealth(): Promise<boolean> {
  try {
    await request<{ ok: boolean }>("/health");
    return true;
  } catch {
    return false;
  }
}

export async function listFleetProjects(): Promise<Project[]> {
  const data = await request<{ projects: Project[] }>("/projects");
  return data.projects;
}

export async function createFleetProject(input: {
  name: string;
  vesselName?: string;
  vesselId?: string;
}): Promise<Project> {
  const data = await request<{ project: Project }>("/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.project;
}

export async function getFleetSnapshot(projectId: string): Promise<{
  project: Project;
  snapshot: CompareAppSnapshot;
}> {
  return request(`/projects/${projectId}/snapshot`);
}

export async function saveFleetSnapshot(
  projectId: string,
  snapshot: CompareAppSnapshot,
): Promise<void> {
  await request(`/projects/${projectId}/snapshot`, {
    method: "PUT",
    body: JSON.stringify({ snapshot }),
  });
}

export async function deleteFleetProject(projectId: string): Promise<void> {
  await request(`/projects/${projectId}`, { method: "DELETE" });
}

export async function getSyncStatus(): Promise<SyncStatus> {
  return request("/sync/status");
}

export { BASE as fleetApiBaseUrl };
