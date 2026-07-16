type InvoiceFileFetchResult = {
  blob: Blob;
  fileName: string;
};

function fileNameFromUrl(fileUrl: string): string {
  try {
    const path = fileUrl.split("?")[0];
    const segment = path.split("/").pop();
    return segment && segment.length > 0 ? decodeURIComponent(segment) : "invoice";
  } catch {
    return "invoice";
  }
}

async function fetchInvoiceFile(fileUrl: string): Promise<InvoiceFileFetchResult> {
  const proxyUrl = `/api/invoices/download?fileUrl=${encodeURIComponent(fileUrl)}`;
  const response = await fetch(proxyUrl, { credentials: "include" });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || "Failed to fetch invoice file");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = (await response.json()) as { downloadUrl?: string; error?: string };
    if (!data.downloadUrl) {
      throw new Error(data.error || "Failed to fetch invoice file");
    }
    const remote = await fetch(data.downloadUrl);
    if (!remote.ok) {
      throw new Error("Failed to fetch invoice file");
    }
    const blob = await remote.blob();
    if (blob.size === 0) {
      throw new Error("Downloaded invoice file is empty");
    }
    return { blob, fileName: fileNameFromUrl(fileUrl) };
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error("Downloaded invoice file is empty");
  }

  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] || fileNameFromUrl(fileUrl);

  return { blob, fileName };
}

function openBlobInNewTab(blob: Blob): void {
  const blobUrl = URL.createObjectURL(blob);
  const opened = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    const link = document.createElement("a");
    link.href = blobUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

async function openDirectFileUrl(fileUrl: string): Promise<void> {
  window.open(fileUrl, "_blank", "noopener,noreferrer");
}

function usesInvoiceDownloadProxy(fileUrl: string): boolean {
  return fileUrl.includes("storage.googleapis.com") || fileUrl.startsWith("local://");
}

/** Open invoice or owner-approval attachment in a new tab for viewing. */
export async function openInvoiceFileView(fileUrl: string): Promise<void> {
  if (!usesInvoiceDownloadProxy(fileUrl)) {
    await openDirectFileUrl(fileUrl);
    return;
  }

  const { blob } = await fetchInvoiceFile(fileUrl);
  openBlobInNewTab(blob);
}

/** Download invoice or owner-approval attachment to the user's device. */
export async function downloadInvoiceFile(
  fileUrl: string,
  preferredFileName?: string
): Promise<void> {
  if (!usesInvoiceDownloadProxy(fileUrl)) {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = preferredFileName || fileNameFromUrl(fileUrl);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  const { blob, fileName } = await fetchInvoiceFile(fileUrl);
  triggerBlobDownload(blob, preferredFileName || fileName);
}

/** @deprecated Use openInvoiceFileView */
export async function openInvoiceFileDownload(fileUrl: string): Promise<void> {
  await openInvoiceFileView(fileUrl);
}
