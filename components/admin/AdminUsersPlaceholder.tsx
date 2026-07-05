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
          Invite users by type — System, Office, Vessel, Shipyard, or External (vendors and other
          external parties). Assign roles and scope; effective permissions come from role page access.
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
          <li>System — platform administration</li>
          <li>Office — shore staff and technical superintendents</li>
          <li>Vessel — onboard crew via ship access portal</li>
          <li>Shipyard — dockyard execution and workshops</li>
          <li>External — vendors, makers, class, and other third parties</li>
        </ul>
      </CardContent>
    </Card>
  );
}
