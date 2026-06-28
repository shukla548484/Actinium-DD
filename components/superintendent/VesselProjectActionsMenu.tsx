"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type VesselProjectActionsMenuProps = {
  vesselId: string;
};

export function VesselProjectActionsMenu({ vesselId }: VesselProjectActionsMenuProps) {
  const base = `/superintendent/vessels/${vesselId}/projects`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Project actions</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem render={<Link href={`${base}/new`} />}>
          Create project
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={base} />}>View projects</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={`${base}/status`} />}>
          Update project status
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/superintendent/vessels/${vesselId}`} />}>
          Vessel profile
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
