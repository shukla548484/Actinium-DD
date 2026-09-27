import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ACTIVE_PROJECT_COOKIE_MAX_AGE,
  dryDockProjectScopeWhere,
  getScopedVesselIds,
  resolveActiveDryDockProject,
  SUPERINTENDENT_ACTIVE_PROJECT_COOKIE,
  SUPERINTENDENT_EMPLOYEE_COOKIE,
} from "@/lib/superintendent/scope";
import { notDeleted } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function clearActiveProjectCookie(res: NextResponse) {
  res.cookies.set(SUPERINTENDENT_ACTIVE_PROJECT_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
}

function setActiveProjectCookie(res: NextResponse, projectId: string) {
  res.cookies.set(SUPERINTENDENT_ACTIVE_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACTIVE_PROJECT_COOKIE_MAX_AGE,
  });
}

export async function GET() {
  const jar = await cookies();
  const employeeId = jar.get(SUPERINTENDENT_EMPLOYEE_COOKIE)?.value?.trim() ?? null;
  const vesselIds = await getScopedVesselIds();
  const activeProject = await resolveActiveDryDockProject();

  let employee: { id: string; name: string; designation: string | null } | null = null;
  if (employeeId) {
    const row = await prisma.employee.findFirst({
      where: { id: employeeId, ...notDeleted },
      select: { id: true, firstName: true, lastName: true, designation: true },
    });
    if (row) {
      employee = {
        id: row.id,
        name: `${row.firstName} ${row.lastName}`,
        designation: row.designation,
      };
    }
  }

  const employees = await prisma.employee.findMany({
    where: { ...notDeleted, status: "active" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      designation: true,
      _count: { select: { vesselAssignments: true } },
    },
    take: 200,
  });

  const res = NextResponse.json({
    employeeId,
    employee,
    vesselIds: vesselIds ?? null,
    scoped: employeeId != null,
    employees: employees.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      designation: e.designation,
      vesselCount: e._count.vesselAssignments,
    })),
    activeProjectId: activeProject?.id ?? null,
    activeProject,
  });

  // Clear stale cookie when project was deleted / left vessel scope.
  if (!activeProject && jar.get(SUPERINTENDENT_ACTIVE_PROJECT_COOKIE)?.value) {
    clearActiveProjectCookie(res);
  }

  return res;
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    employeeId?: string | null;
    activeProjectId?: string | null;
    /** When true, only update active project (leave employee cookie alone). */
    activeProjectOnly?: boolean;
  };

  const touchEmployee = !body.activeProjectOnly && "employeeId" in body;
  const touchProject = "activeProjectId" in body || body.activeProjectOnly === true;

  const res = NextResponse.json({
    ok: true,
    employeeId: touchEmployee ? (body.employeeId ?? null) : undefined,
    activeProjectId: touchProject ? (body.activeProjectId ?? null) : undefined,
  });

  if (touchEmployee) {
    if (body.employeeId) {
      const exists = await prisma.employee.findFirst({
        where: { id: body.employeeId, ...notDeleted, status: "active" },
      });
      if (!exists) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 });
      }
      res.cookies.set(SUPERINTENDENT_EMPLOYEE_COOKIE, body.employeeId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: ACTIVE_PROJECT_COOKIE_MAX_AGE,
      });
    } else {
      res.cookies.set(SUPERINTENDENT_EMPLOYEE_COOKIE, "", {
        httpOnly: true,
        path: "/",
        maxAge: 0,
      });
    }
  }

  if (touchProject) {
    if (body.activeProjectId) {
      const vesselIds = await getScopedVesselIds();
      const project = await prisma.dryDockProject.findFirst({
        where: {
          id: body.activeProjectId,
          ...notDeleted,
          archivedAt: null,
          ...dryDockProjectScopeWhere(vesselIds),
        },
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json(
          { error: "Dry dock project not found or outside your scope" },
          { status: 404 },
        );
      }
      setActiveProjectCookie(res, project.id);
    } else {
      clearActiveProjectCookie(res);
    }
  }

  return res;
}
