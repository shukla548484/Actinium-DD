"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AdminUsersPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User management</CardTitle>
        <CardDescription>
          Invite office staff, assign roles, and set vessel or project scope. This connects to
          per-user login in the next RBAC phase.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          User accounts are not created yet. For now, configure which pages each role can access
          under{" "}
          <Button
            variant="link"
            className="h-auto p-0"
            render={<Link href="/admin/access" />}
            nativeButton={false}
          >
            Page access
          </Button>
          . When users are added, their effective permissions will come from their assigned roles
          plus any company overrides.
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>Company Admin assigns roles to shore staff</li>
          <li>Technical Superintendent scoped to assigned vessels</li>
          <li>Shipyard users bound to a single yard invite / project</li>
        </ul>
      </CardContent>
    </Card>
  );
}
