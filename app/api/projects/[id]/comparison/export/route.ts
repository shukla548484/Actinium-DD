import { NextResponse } from "next/server";
import { buildHybridComparison } from "@/lib/tender/buildHybridComparison";
import { hybridComparisonToWorkbook } from "@/lib/tender/exportHybridComparison";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const comparison = await buildHybridComparison(id);
  if (!comparison) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const wb = hybridComparisonToWorkbook(comparison);
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="tender-comparison-${id.slice(0, 8)}.xlsx"`,
    },
  });
}
