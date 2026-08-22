import { ensureDatabaseUrl } from "@/lib/db/resolveDatabaseUrl";
import { Prisma, PrismaClient } from "@prisma/client";

ensureDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaFingerprint?: string;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function modelHasField(modelName: string, fieldName: string): boolean {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === modelName);
  return model?.fields.some((f) => f.name === fieldName) ?? false;
}

/** Fingerprint of schema fields that force client recreation after generate. */
function prismaSchemaFingerprint(): string {
  const dd = Prisma.dmmf.datamodel.models.find((m) => m.name === "DryDockProject");
  const project = Prisma.dmmf.datamodel.models.find((m) => m.name === "Project");
  if (!dd || !project) return "missing-project-models";
  const ddRequired = [
    "projectType",
    "priority",
    "expectedSailing",
    "baselineLockedAt",
    "workspaceProvisionedAt",
    "archivedAt",
    "archivedByUserId",
  ];
  const projectRequired = ["archivedAt", "archivedByUserId", "preferredShipyards"];
  const defects = Prisma.dmmf.datamodel.models.find((m) => m.name === "DdProjectDefect");
  return [
    ...ddRequired.map((name) => (dd.fields.some((f) => f.name === name) ? "1" : "0")),
    ...projectRequired.map((name) =>
      project.fields.some((f) => f.name === name) ? "1" : "0",
    ),
    defects?.fields.some((f) => f.name === "requisitionNumber") ? "1" : "0",
  ].join("");
}

function isStalePrismaClient(client: PrismaClient | undefined): boolean {
  if (!client) return true;

  const fingerprint = prismaSchemaFingerprint();
  if (globalForPrisma.prismaSchemaFingerprint !== fingerprint) return true;

  if (!modelHasField("Company", "category")) return true;
  if (!modelHasField("DryDockProject", "projectType")) return true;
  if (!modelHasField("DryDockProject", "archivedAt")) return true;
  if (!modelHasField("Project", "archivedAt")) return true;
  if (!modelHasField("EmployeeModuleAssignment", "moduleCode")) return true;
  if (!modelHasField("EmployeeModulePage", "pageKey")) return true;
  if (!modelHasField("DdProjectDefect", "requisitionNumber")) return true;

  const extended = client as PrismaClient & {
    company?: { count?: unknown };
    employeeModuleAssignment?: { findMany?: unknown };
    employeeModulePage?: { findMany?: unknown };
    ddProjectDefect?: { count?: unknown };
  };
  if (typeof extended.company?.count !== "function") return true;
  if (typeof extended.employeeModuleAssignment?.findMany !== "function") return true;
  if (typeof extended.employeeModulePage?.findMany !== "function") return true;
  if (typeof extended.ddProjectDefect?.count !== "function") return true;

  return false;
}

/** Dev hot-reload can keep a PrismaClient from before schema changes — recreate if models are missing. */
function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && !isStalePrismaClient(cached)) return cached;

  if (cached) {
    void cached.$disconnect().catch(() => {});
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaSchemaFingerprint = prismaSchemaFingerprint();
  return client;
}

/** Lazy proxy — re-resolves client after Turbopack hot reload / schema changes. */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = client[prop as keyof PrismaClient];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});
