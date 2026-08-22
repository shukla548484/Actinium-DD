"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationBar } from "@/components/superintendent/PaginationBar";
import type { DdVesselJobDto } from "@/lib/superintendent/types";

const PAGE_SIZE = 8;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: DdVesselJobDto[];
  onContinueShare: () => void;
};

export function SelectedJobsPreviewDialog({
  open,
  onOpenChange,
  jobs,
  onContinueShare,
}: Props) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (open) setPage(1);
  }, [open, jobs.length]);

  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => jobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [jobs, safePage],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[75vh] max-h-[75vh] w-[90vw] max-w-[90vw] flex-col gap-4 overflow-hidden sm:max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>Selected jobs</DialogTitle>
          <DialogDescription>
            Review {jobs.length} selected job{jobs.length === 1 ? "" : "s"} before sharing to
            shipyard for quotation.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="whitespace-nowrap">Assignment No.</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No jobs selected.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="max-w-[18rem] font-medium">{job.title}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {job.jobCode ?? "—"}
                    </TableCell>
                    <TableCell>{job.category}</TableCell>
                    <TableCell className="capitalize">{job.priority}</TableCell>
                    <TableCell className="capitalize">
                      {job.status.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {job.submittedAt
                        ? new Date(job.submittedAt).toLocaleDateString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <PaginationBar
          page={safePage}
          totalPages={totalPages}
          total={jobs.length}
          onPageChange={setPage}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={jobs.length === 0}
            onClick={() => {
              onOpenChange(false);
              onContinueShare();
            }}
          >
            Continue to share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
