import { NextResponse } from "next/server";
import { getYardQuoteByToken } from "@/lib/db/index";
import {
  DOCKING_COST_BUCKET,
  GENERAL_SERVICE_COST_BUCKET,
} from "@/lib/tender/catalogBuckets";
import { buildYardQuoteTemplateWorkbook } from "@/lib/tender/specExcel";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const quote = await getYardQuoteByToken(token);
  if (!quote) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const step = searchParams.get("step");

  let bucketFilter: string[] | undefined;
  let filename = "yard-quote-template.xlsx";

  if (step === "docking") {
    bucketFilter = [DOCKING_COST_BUCKET];
    filename = "yard-quote-01-docking.xlsx";
  } else if (step === "general") {
    bucketFilter = [GENERAL_SERVICE_COST_BUCKET];
    filename = "yard-quote-02-general-services.xlsx";
  }

  const buffer = buildYardQuoteTemplateWorkbook(quote, bucketFilter);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
