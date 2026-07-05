"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RbacUserType } from "@prisma/client";

type ProfileUser = {
  displayName: string;
  loginId: string | null;
  employeeCode: string | null;
  email?: string;
  designation: string | null;
  vesselLoginId: string | null;
  rbacUserType?: RbacUserType;
  rbacUserTypeLabel?: string;
  roleCode: string | null;
  roleName: string | null;
  vessels: { id: string; code: string; name: string }[];
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value?.trim() ? value : "—"}</p>
    </div>
  );
}

export function AccountProfilePanel() {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user as ProfileUser);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading profile…</p>;
  }

  if (!user) {
    return <p className="text-sm text-muted-foreground">Unable to load profile. Please sign in again.</p>;
  }

  const assignedVessel = user.vessels[0];

  return (
    <div className="grid max-w-3xl gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">{user.displayName}</CardTitle>
            <CardDescription>Account overview and portal identity</CardDescription>
          </div>
          {user.rbacUserTypeLabel ? (
            <Badge variant="secondary">{user.rbacUserTypeLabel}</Badge>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Login ID" value={user.loginId ?? user.employeeCode} />
          <Field label="Employee code" value={user.employeeCode} />
          <Field label="Email" value={user.email} />
          <Field label="Designation" value={user.designation ?? user.roleName} />
          <Field label="Role code" value={user.roleCode} />
          {user.vesselLoginId ? <Field label="Vessel login ID" value={user.vesselLoginId} /> : null}
          {assignedVessel ? (
            <Field label="Assigned vessel" value={`${assignedVessel.name} (${assignedVessel.code})`} />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
          <CardDescription>Manage your sign-in credentials</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/account/password" />} nativeButton={false}>
            Change password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
