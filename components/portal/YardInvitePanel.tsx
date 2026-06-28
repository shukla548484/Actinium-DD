"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCard } from "@/components/layout/TableCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LOCALE_LABELS, type ScopeLocale } from "@/lib/i18n/scope";
import { yardPortalUrl } from "@/lib/tender/format";
import type { YardInvite, YardInviteStatus } from "@/lib/tender/types";
import { buildYardInviteMailto } from "@/lib/mail/yardInviteMailto";

interface Props {
  projectId: string;
  projectName: string;
  vesselName?: string | null;
  invites: YardInvite[];
  onInviteCreated?: () => void;
}

const STATUS_COLORS: Record<YardInviteStatus, string> = {
  invited: "bg-zinc-100 text-zinc-700",
  in_progress: "bg-amber-100 text-amber-800",
  submitted: "bg-blue-100 text-blue-800",
  excel_imported: "bg-blue-100 text-blue-800",
  shortlisted: "bg-purple-100 text-purple-800",
  accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<YardInviteStatus, string> = {
  invited: "Invited",
  in_progress: "In progress",
  submitted: "Submitted",
  excel_imported: "Excel imported",
  shortlisted: "Shortlisted",
  accepted: "Accepted",
  rejected: "Rejected",
};

export function YardInvitePanel({
  projectId,
  projectName,
  vesselName,
  invites: initialInvites,
  onInviteCreated,
}: Props) {
  const [invites, setInvites] = useState(initialInvites);
  const [yardName, setYardName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [preferredLocale, setPreferredLocale] = useState<ScopeLocale>("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!yardName.trim()) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/projects/${projectId}/yards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yardName: yardName.trim(),
        contactEmail: contactEmail.trim() || undefined,
        preferredLocale,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to invite yard.");
      return;
    }

    if (data.invite) {
      setInvites((prev) => [...prev, data.invite]);
    }
    if (data.mailtoLink) {
      window.open(data.mailtoLink, "_blank");
    }

    setYardName("");
    setContactEmail("");
    onInviteCreated?.();
  }

  async function changeStatus(inviteId: string, status: YardInviteStatus) {
    setActionLoading(inviteId);
    const res = await fetch(`/api/projects/${projectId}/yards/${inviteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setActionLoading(null);
    if (res.ok) {
      setInvites((prev) =>
        prev.map((inv) => (inv.id === inviteId ? { ...inv, status } : inv)),
      );
    }
  }

  async function removeInvite(inviteId: string) {
    setActionLoading(inviteId);
    const res = await fetch(`/api/projects/${projectId}/yards/${inviteId}`, {
      method: "DELETE",
    });
    setActionLoading(null);
    setRemoveTarget(null);
    if (res.ok) {
      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
      onInviteCreated?.();
    }
  }

  function buildInviteMailto(inv: YardInvite): string {
    if (!inv.contactEmail) return "#";
    return buildYardInviteMailto({
      contactEmail: inv.contactEmail,
      yardName: inv.yardName,
      projectName,
      vesselName,
      token: inv.token,
    });
  }

  function copyLink(token: string) {
    const url = yardPortalUrl(token);
    void navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  const canAct = (status: YardInviteStatus) =>
    status === "submitted" || status === "excel_imported" || status === "shortlisted";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Invite shipyard</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={invite} className="space-y-3">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="yard-name">Yard name *</Label>
                <Input
                  id="yard-name"
                  value={yardName}
                  onChange={(e) => setYardName(e.target.value)}
                  placeholder="Yard name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Contact email</Label>
                <Input
                  id="contact-email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="Contact email"
                  type="email"
                />
              </div>
              <div className="space-y-2">
                <Label>Locale</Label>
                <Select
                  value={preferredLocale}
                  onValueChange={(v) => setPreferredLocale(v as ScopeLocale)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["en", "zh", "ja"] as ScopeLocale[]).map((l) => (
                      <SelectItem key={l} value={l}>
                        {LOCALE_LABELS[l]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Sending…" : "Create invite link"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <AlertDialog
        open={removeTarget != null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove yard invite?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this yard invite? This will also delete their quote data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => removeTarget && void removeInvite(removeTarget)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {invites.length > 0 && (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Yard</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Locale</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Portal link</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.yardName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {inv.contactEmail ? (
                      <a
                        href={buildInviteMailto(inv)}
                        className="text-primary hover:underline"
                        title="Email yard with quote link"
                      >
                        {inv.contactEmail}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {LOCALE_LABELS[inv.preferredLocale]}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[inv.status]}>
                      {STATUS_LABEL[inv.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {inv.submittedAt
                      ? new Date(inv.submittedAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => copyLink(inv.token)}
                    >
                      {copied === inv.token ? "Copied!" : "Copy link"}
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="ml-3 h-auto p-0 text-muted-foreground"
                      render={
                        <a
                          href={yardPortalUrl(inv.token)}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      Open
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {canAct(inv.status) && inv.status !== "shortlisted" && (
                        <ActionBtn
                          label="Shortlist"
                          variant="outline"
                          className="border-purple-200 text-purple-700 hover:bg-purple-50"
                          loading={actionLoading === inv.id}
                          onClick={() => changeStatus(inv.id, "shortlisted")}
                        />
                      )}
                      {canAct(inv.status) && (
                        <ActionBtn
                          label="Accept"
                          variant="outline"
                          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          loading={actionLoading === inv.id}
                          onClick={() => changeStatus(inv.id, "accepted")}
                        />
                      )}
                      {canAct(inv.status) && (
                        <ActionBtn
                          label="Reject"
                          variant="outline"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          loading={actionLoading === inv.id}
                          onClick={() => changeStatus(inv.id, "rejected")}
                        />
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setRemoveTarget(inv.id)}
                        disabled={actionLoading === inv.id}
                        title="Remove invite"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </div>
  );
}

function ActionBtn({
  label,
  variant,
  className,
  loading,
  onClick,
}: {
  label: string;
  variant: "outline";
  className?: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="xs"
      onClick={onClick}
      disabled={loading}
      className={className}
    >
      {label}
    </Button>
  );
}
