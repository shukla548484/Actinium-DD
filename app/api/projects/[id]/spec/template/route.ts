import { NextResponse } from "next/server";
import { ensureProjectCategories } from "@/lib/db/categories";
import { getProject, listSpecLines } from "@/lib/db/index";
import { buildEmptySpecTemplateWorkbook, buildSpecTemplateWorkbook } from "@/lib/tender/specExcel";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await context.params;
  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "current";
  const bucket = searchParams.get("bucket") ?? undefined;
  const buckets = searchParams
    .get("buckets")
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const categories = await ensureProjectCategories(projectId);
  const selectedCategories =
    buckets && buckets.length > 0
      ? categories.filter((category) => buckets.includes(category.slug))
      : categories;
  if (buckets && buckets.length > 0 && selectedCategories.length === 0) {
    return NextResponse.json({ error: "No matching categories selected." }, { status: 400 });
  }

  let buffer: Buffer;
  let filename: string;

  if (mode === "empty") {
    buffer = buildEmptySpecTemplateWorkbook(selectedCategories);
    const suffix =
      selectedCategories.length === 1
        ? selectedCategories[0]?.slug
        : `${selectedCategories.length}-categories`;
    filename = `${project.referenceCode ?? project.id}-spec-template-${suffix}.xlsx`;
  } else {
    const lines = await listSpecLines(projectId);
    const filtered =
      buckets && buckets.length > 0
        ? lines.filter((line) => buckets.includes(line.bucket))
        : bucket
          ? lines.filter((line) => line.bucket === bucket)
          : lines;
    buffer = buildSpecTemplateWorkbook(filtered, categories);
    filename = bucket
      ? `${project.referenceCode ?? project.id}-spec-${bucket}.xlsx`
      : `${project.referenceCode ?? project.id}-spec.xlsx`;
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
