import type { ListQuery } from "@/lib/superintendent/types";

export function parseListQuery(params: URLSearchParams): ListQuery {
  const page = params.get("page");
  const limit = params.get("limit");
  const search = params.get("search") ?? undefined;
  const status = params.get("status") ?? undefined;
  const vesselId = params.get("vesselId") ?? undefined;
  const dryDockProjectId = params.get("dryDockProjectId") ?? undefined;
  const employeeId = params.get("employeeId") ?? undefined;
  const category = params.get("category") ?? undefined;
  const vesselIdsParam = params.get("vesselIds");
  const vesselIds = vesselIdsParam
    ? vesselIdsParam.split(",").map((id) => id.trim()).filter(Boolean)
    : undefined;

  return {
    page: page ? Number.parseInt(page, 10) : undefined,
    limit: limit ? Number.parseInt(limit, 10) : undefined,
    search: search || undefined,
    status: status || undefined,
    vesselId: vesselId || undefined,
    dryDockProjectId: dryDockProjectId || undefined,
    employeeId: employeeId || undefined,
    category: category || undefined,
    vesselIds: vesselIds?.length ? vesselIds : undefined,
  };
}

export function buildPaginatedResponse<TItem>(
  itemsKey: string,
  items: TItem[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    [itemsKey]: items,
    total,
    page,
    limit,
    totalPages: total > 0 ? Math.ceil(total / limit) : 0,
  };
}
