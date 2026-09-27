import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { convertToBrowserJpeg } from "@/lib/superintendent/serverImagePreview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PREVIEW_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Select a valid image" }, { status: 400 });
  }
  if (file.size > MAX_PREVIEW_BYTES) {
    return NextResponse.json({ error: "Image must be 25 MB or smaller" }, { status: 400 });
  }

  try {
    const jpeg = await convertToBrowserJpeg(Buffer.from(await file.arrayBuffer()), file.name, 1200);
    return new Response(new Uint8Array(jpeg), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "Content-Length": String(jpeg.length),
      },
    });
  } catch (error) {
    console.error("Daily report image preview conversion failed", error);
    return NextResponse.json(
      { error: "This image format could not be previewed. Please use JPG, PNG, or HEIC." },
      { status: 422 },
    );
  }
}
