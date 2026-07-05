import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";

export async function getFleetDashboardStats() {
  const [activeVessels, dryDockActive, dryDockPlanning, employees, crewAssigned] =
    await Promise.all([
      prisma.vessel.count({ where: { ...notDeleted, status: "active" } }),
      prisma.dryDockProject.count({
        where: {
          ...notDeleted,
          status: { in: ["execution", "in_progress", "docking", "mobilization"] },
        },
      }),
      prisma.dryDockProject.count({
        where: { ...notDeleted, status: { in: ["planning", "draft", "budgeting"] } },
      }),
      prisma.employee.count({ where: { ...notDeleted, status: "active" } }),
      prisma.employeeVessel.count({ where: { signOffDate: null } }),
    ]);

  return {
    activeVessels,
    dryDockActive,
    dryDockPlanning,
    activeEmployees: employees,
    crewAssignments: crewAssigned,
  };
}

export async function getExecutiveBudgetSummary() {
  const projects = await prisma.dryDockProject.findMany({
    where: { ...notDeleted, status: { not: "cancelled" } },
    select: {
      id: true,
      name: true,
      referenceCode: true,
      approvedBudget: true,
      budgetTotal: true,
      budgetLines: {
        where: notDeleted,
        select: { budgetAmount: true, actualAmount: true, approvedAmount: true },
      },
      purchaseOrders: {
        where: notDeleted,
        select: { amount: true, status: true },
      },
      invoices: {
        where: notDeleted,
        select: { amount: true, status: true },
      },
    },
    take: 50,
    orderBy: { updatedAt: "desc" },
  });

  let totalBudget = 0;
  let totalActual = 0;
  let totalCommitted = 0;
  let totalInvoiced = 0;

  const rows = projects.map((p) => {
    const budget =
      p.approvedBudget ??
      p.budgetTotal ??
      p.budgetLines.reduce((s, l) => s + l.budgetAmount, 0);
    const actual = p.budgetLines.reduce((s, l) => s + (l.actualAmount ?? 0), 0);
    const poCommitted = p.purchaseOrders
      .filter((po) => !["draft", "cancelled"].includes(po.status))
      .reduce((s, po) => s + po.amount, 0);
    const invoiced = p.invoices
      .filter((inv) => !["draft", "rejected"].includes(inv.status))
      .reduce((s, inv) => s + inv.amount, 0);

    totalBudget += budget;
    totalActual += actual;
    totalCommitted += poCommitted;
    totalInvoiced += invoiced;

    return {
      projectId: p.id,
      code: p.referenceCode,
      name: p.name,
      budget,
      actual,
      poCommitted,
      invoiced,
      variance: budget - Math.max(actual, poCommitted, invoiced),
    };
  });

  return {
    totals: {
      budget: totalBudget,
      actual: totalActual,
      poCommitted: totalCommitted,
      invoiced: totalInvoiced,
      variance: totalBudget - Math.max(totalActual, totalCommitted, totalInvoiced),
    },
    projects: rows,
  };
}

export async function getCrewingDashboardStats() {
  const [activeEmployees, waitingAssignment, inactive, vesselCount] = await Promise.all([
    prisma.employee.count({ where: { ...notDeleted, status: "active" } }),
    prisma.employee.count({ where: { ...notDeleted, status: "wait" } }),
    prisma.employee.count({ where: { ...notDeleted, status: "inactive" } }),
    prisma.vessel.count({ where: { ...notDeleted, status: "active" } }),
  ]);

  const byRole = await prisma.employee.groupBy({
    by: ["designation"],
    where: { ...notDeleted, status: "active", designation: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 8,
  });

  return {
    activeEmployees,
    waitingAssignment,
    inactive,
    activeVessels: vesselCount,
    topDesignations: byRole.map((r) => ({
      designation: r.designation ?? "Unknown",
      count: r._count.id,
    })),
  };
}

export async function getHseqDashboardStats() {
  const [openApprovals, pendingInvoices, overdueChecklist] = await Promise.all([
    prisma.ddApprovalRequest.count({ where: { ...notDeleted, status: "pending" } }),
    prisma.ddInvoice.count({ where: { ...notDeleted, status: "submitted" } }),
    prisma.ddChecklistItem.count({
      where: {
        ...notDeleted,
        isCompleted: false,
        dueDate: { lt: new Date() },
      },
    }),
  ]);

  return { openApprovals, pendingInvoices, overdueChecklistItems: overdueChecklist };
}
