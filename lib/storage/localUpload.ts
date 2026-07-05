import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type SavedLocalUpload = {
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number;
  storedName: string;
};

export async function saveLocalUpload(input: {
  file: File;
  /** Path segments under `public/uploads/`, e.g. `["ship-access", "vessel-jobs", jobId]`. */
  segments: string[];
}): Promise<SavedLocalUpload> {
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${Date.now()}-${safeName}`;
  const dir = path.join(process.cwd(), "public", "uploads", ...input.segments);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), bytes);

  const urlPath = `/uploads/${input.segments.join("/")}/${storedName}`;
  return {
    fileName: input.file.name,
    fileUrl: urlPath,
    mimeType: input.file.type || null,
    fileSize: bytes.length,
    storedName,
  };
}
