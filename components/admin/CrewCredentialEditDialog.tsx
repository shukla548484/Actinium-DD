"use client";

import type { EntityStatus } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PhoneNumberField } from "@/components/admin/PhoneNumberField";
import { ENTITY_STATUS_OPTIONS, EntityStatusBadge } from "@/components/admin/EntityStatusBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_EMPLOYEE_PASSWORD } from "@/lib/auth/constants";
import type { CrewCredentialDetailDto } from "@/lib/db/crewCredentials";
import {
  formatPhoneE164,
  isValidLocalPhoneNumber,
  parseStoredPhone,
} from "@/lib/admin/phone";

type RoleOption = {
  roleCode: string;
  designation: string;
  department: string;
};

type Props = {
  vesselId: string;
  employeeId: string | null;
  roleOptions: RoleOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function CrewCredentialEditDialog({
  vesselId,
  employeeId,
  roleOptions,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credential, setCredential] = useState<CrewCredentialDetailDto | null>(null);
  const [roleCode, setRoleCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dialCode, setDialCode] = useState("91");
  const [localNumber, setLocalNumber] = useState("");
  const [isWatchKeeper, setIsWatchKeeper] = useState(false);
  const [status, setStatus] = useState<EntityStatus>("active");
  const [resetPassword, setResetPassword] = useState(false);

  const roleItems = useMemo(
    () =>
      roleOptions.map((role) => ({
        value: role.roleCode,
        label: `${role.designation} · ${role.department}`,
        searchText: `${role.designation} ${role.department}`,
      })),
    [roleOptions],
  );

  const loadCredential = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    const res = await fetch(
      `/api/admin/vessels/${vesselId}/crew-credentials/${employeeId}`,
    );
    const data = (await res.json()) as {
      credential?: CrewCredentialDetailDto;
      error?: string;
    };
    setLoading(false);

    if (!res.ok || !data.credential) {
      setError(data.error ?? "Failed to load crew credential");
      setCredential(null);
      return;
    }

    const row = data.credential;
    const phone = parseStoredPhone(row.phone);
    setCredential(row);
    setRoleCode(row.roleCode ?? "");
    setFirstName(row.firstName);
    setLastName(row.lastName);
    setEmail(row.email);
    setDialCode(phone.dialCode);
    setLocalNumber(phone.localNumber);
    setIsWatchKeeper(row.isWatchKeeper);
    setStatus(row.status);
    setResetPassword(false);
  }, [employeeId, vesselId]);

  useEffect(() => {
    if (open && employeeId) {
      void loadCredential();
    } else if (!open) {
      setCredential(null);
      setError(null);
    }
  }, [open, employeeId, loadCredential]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) return;
    if (!roleCode) {
      setError("Select a crew designation");
      return;
    }
    if (!isValidLocalPhoneNumber(localNumber)) {
      setError("Enter a valid 10-digit phone number with country code");
      return;
    }

    setBusy(true);
    setError(null);

    const res = await fetch(
      `/api/admin/vessels/${vesselId}/crew-credentials/${employeeId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleCode,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: formatPhoneE164(dialCode, localNumber),
          isWatchKeeper,
          status,
          resetPassword,
        }),
      },
    );
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to update crew credential");
      return;
    }

    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit crew credential</DialogTitle>
          <DialogDescription>
            Update onboard login details. Crew sign in with the vessel login ID only.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : credential ? (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Login ID:</span>{" "}
                <span className="font-mono">{credential.loginId}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Vessel login ID:</span>{" "}
                <span className="font-mono">{credential.vesselLoginId}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Changing designation may assign a new vessel login ID.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editCrewDesignation">Crew designation</Label>
              <SearchableSelect
                id="editCrewDesignation"
                items={roleItems}
                value={roleCode}
                onValueChange={setRoleCode}
                placeholder="Search designation…"
                searchPlaceholder="Search by role or department…"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editFirstName">First name</Label>
                <Input
                  id="editFirstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editLastName">Last name</Label>
                <Input
                  id="editLastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <PhoneNumberField
                dialCode={dialCode}
                localNumber={localNumber}
                onDialCodeChange={setDialCode}
                onLocalNumberChange={setLocalNumber}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as EntityStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_STATUS_OPTIONS.filter((option) => option.value !== "all").map(
                    (option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <EntityStatusBadge status={status} />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={isWatchKeeper}
                onCheckedChange={(checked) => setIsWatchKeeper(checked === true)}
              />
              Watch keeper on this vessel
            </label>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={resetPassword}
                onCheckedChange={(checked) => setResetPassword(checked === true)}
              />
              Reset password to default ({DEFAULT_EMPLOYEE_PASSWORD})
            </label>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <Alert variant="destructive">
            <AlertDescription>{error ?? "Crew credential not found"}</AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}
