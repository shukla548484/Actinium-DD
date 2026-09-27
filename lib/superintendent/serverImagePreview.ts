import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

async function finishJpeg(bytes: Buffer, maxDimension: number): Promise<Buffer> {
  return sharp(bytes, { animated: false })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 86, progressive: false, chromaSubsampling: "4:2:0" })
    .toBuffer();
}

/** Convert uploaded photos, including macOS HEIC/HEIF images, to browser-safe JPEG. */
export async function convertToBrowserJpeg(
  bytes: Buffer,
  fileName: string,
  maxDimension = 1600,
): Promise<Buffer> {
  try {
    return await finishJpeg(bytes, maxDimension);
  } catch (sharpError) {
    if (process.platform !== "darwin") throw sharpError;

    const tempDir = await mkdtemp(path.join(os.tmpdir(), "actinium-image-preview-"));
    const extension = path.extname(fileName).replace(/[^a-zA-Z0-9.]/g, "") || ".img";
    const inputPath = path.join(tempDir, `source${extension}`);
    const outputPath = path.join(tempDir, "preview.jpg");

    try {
      await writeFile(inputPath, bytes);
      await execFileAsync(
        "/usr/bin/sips",
        ["-s", "format", "jpeg", inputPath, "--out", outputPath],
        { timeout: 20_000, maxBuffer: 1024 * 1024 },
      );
      return await finishJpeg(await readFile(outputPath), maxDimension);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
