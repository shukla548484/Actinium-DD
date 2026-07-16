"use client";

import { Button } from "@/components/ui/button";
import { Download, Paperclip } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AttachmentRow = {
  quoteId: string;
  rank: number;
  vendorName: string;
  fileName?: string | null;
  fileUrl?: string | null;
  fileAttachmentId?: string | null;
  referenceDocuments?: Array<{ id: string; filename: string; fileUrl: string | null }>;
  deliveryChargesAttachment?: string | null;
};

type Props = {
  rows: AttachmentRow[];
};

function openAttachment(fileAttachmentId?: string | null, fileUrl?: string | null) {
  if (fileAttachmentId) {
    window.open(`/api/emails/attachments/${fileAttachmentId}/download`, "_blank");
  } else if (fileUrl) {
    window.open(fileUrl, "_blank");
  }
}

const th = "h-9 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const td = "px-3 py-2 text-[11px] font-normal align-middle";

export function ComparisonAttachmentsTab({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center">
        <Paperclip className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">No attachments available</p>
        <p className="text-xs text-muted-foreground">Quote files and vendor documents will appear here once received.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Quote attachments</p>
          <p className="text-[11px] text-muted-foreground">Downloaded files open exactly as received from vendor email.</p>
        </div>
        <span className="text-[11px] text-muted-foreground">{rows.length} vendors</span>
      </div>
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-background hover:bg-background">
            <TableHead className={`${th} w-8 text-center`}>#</TableHead>
            <TableHead className={th}>Vendor</TableHead>
            <TableHead className={th}>Quote file</TableHead>
            <TableHead className={th}>Delivery chg.</TableHead>
            <TableHead className={th}>Reference docs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.quoteId}>
              <TableCell className={`${td} text-center font-semibold`}>{r.rank}</TableCell>
              <TableCell className={`${td} font-semibold text-foreground`}>{r.vendorName}</TableCell>
              <TableCell className={td}>
                {r.fileUrl || r.fileAttachmentId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 max-w-[260px] justify-start px-2 text-[11px]"
                    onClick={() => openAttachment(r.fileAttachmentId, r.fileUrl)}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{r.fileName || "Download quote"}</span>
                  </Button>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Not attached</span>
                )}
              </TableCell>
              <TableCell className={td}>
                {r.deliveryChargesAttachment ? (
                  <Button variant="outline" size="sm" className="h-8 px-2 text-[11px]" asChild>
                    <a href={r.deliveryChargesAttachment} target="_blank" rel="noopener noreferrer">
                      <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                      View
                    </a>
                  </Button>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Not attached</span>
                )}
              </TableCell>
              <TableCell className={td}>
                {r.referenceDocuments && r.referenceDocuments.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {r.referenceDocuments.map((doc) => (
                      <Button
                        key={doc.id}
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        title={doc.filename}
                        onClick={() => openAttachment(doc.id, doc.fileUrl)}
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                      </Button>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground">No reference docs</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
