"use client";

import type { EntityStatus } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PhoneNumberField } from "@/components/admin/PhoneNumberField";
import { CrewCredentialsListPanel } from "@/components/admin/CrewCredentialsListPanel";
import { EntityStatusBadge } from "@/components/admin/EntityStatusBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { DEFAULT_EMPLOYEE_PASSWORD } from "@/lib/auth/constants";
import { getCrewRankLoginSuffix } from "@/lib/admin/crewLoginSuffix";
import {
  formatPhoneE164,
  isValidLocalPhoneNumber,
} from "@/lib/admin/phone";
import type { CrewCredentialsContextDto } from "@/lib/db/crewCredentials";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

type CreatedCredential = {
  employeeId: string;
  employeeCode: string;
  loginId: string;
  vesselLoginId: string;
  name: string;
  designation: string;
};

export function CrewCredentialPanel({ vesselId }: { vesselId: string }) {
  const router = useRouter();
  const [context, setContext] = useState<CrewCredentialsContextDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoleCode, setSelectedRoleCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dialCode, setDialCode] = useState("91");
  const [localNumber, setLocalNumber] = useState("");
  const [isWatchKeeper, setIsWatchKeeper] = useState(false);
  const [created, setCreated] = useState<CreatedCredential | null>(null);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    const res = await fetch(`/api/admin/vessels/${vesselId}/crew-credentials`);
    let json: CrewCredentialsContextDto & { error?: string };
    try {
      json = (await res.json()) as CrewCredentialsContextDto & { error?: string };
    } catch {
      setError("Failed to load crew credentials");
      setContext(null);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError(json.error ?? "Failed to load crew credentials");
      setContext(null);
    } else {
      setContext(json);
    }
    if (!options?.silent) {
      setLoading(false);
    }
  }, [vesselId]);

  useEffect(() => {
    void load();
  }, [load]);

  const roleItems = useMemo(
    () =>
      (context?.roles ?? []).map((role) => ({
        value: role.roleCode,
        label: `${role.designation} · ${role.department}`,
        searchText: `${role.designation} ${role.department} ${role.description}`,
      })),
    [context?.roles],
  );

  function handleRoleChange(roleCode: string) {
    setSelectedRoleCode(roleCode);
    setCreated(null);
    setError(null);
  }

  function clearFormFields() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setDialCode("91");
    setLocalNumber("");
    setIsWatchKeeper(false);
    setError(null);
  }

  function resetForm() {
    setSelectedRoleCode("");
    setCreated(null);
    clearFormFields();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRoleCode) {
      setError("Select a crew designation");
      return;
    }
    if (!isValidLocalPhoneNumber(localNumber)) {
      setError("Enter a valid 10-digit phone number with country code");
      return;
    }

    setBusy(true);
    setError(null);

    const res = await fetch(`/api/admin/vessels/${vesselId}/crew-credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roleCode: selectedRoleCode,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: formatPhoneE164(dialCode, localNumber),
        isWatchKeeper,
      }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to create crew credential");
      return;
    }

    const employee = data.employee as {
      id: string;
      employeeCode: string;
      loginId?: string;
      vesselLoginId?: string | null;
      firstName: string;
      lastName: string;
      designation: string | null;
    };

    setCreated({
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      loginId: employee.loginId ?? employee.employeeCode,
      vesselLoginId: employee.vesselLoginId ?? "",
      name: `${employee.firstName} ${employee.lastName}`,
      designation: employee.designation ?? "",
    });
    clearFormFields();
    setSelectedRoleCode("");
    void load();
    router.refresh();
  }

  if (loading) {
    return <ActiniumLoadingState label="Loading crew designations…" size="sm" />;
  }

  if (!context) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? "Vessel not found"}</AlertDescription>
      </Alert>
    );
  }

  const selectedRole = context.roles.find((role) => role.roleCode === selectedRoleCode);

  return (
    <div className="space-y-6">
      <Card className="max-w-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Selected vessel</CardTitle>
          <CardDescription>
            {context.vessel.name} · {context.vessel.code} · {context.vessel.companyName}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Create crew credential</CardTitle>
          <CardDescription>
            Search and select an onboard designation, enter crew details, then create and activate
            the login for {context.vessel.name}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {created ? (
            <Alert>
              <AlertDescription className="space-y-2">
                <p>
                  <strong>{created.name}</strong> ({created.designation}) is registered and active
                  on {context.vessel.name}.
                </p>
                <p className="font-mono text-sm">
                  Login ID: {created.loginId}
                  <br />
                  Vessel login ID: {created.vesselLoginId}
                  <br />
                  Temporary password: {DEFAULT_EMPLOYEE_PASSWORD}
                </p>
                <p className="text-xs text-muted-foreground">
                  Crew must sign in with the vessel login ID only. The office login ID is kept
                  for records and admin reference.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  render={<Link href={`/admin/employees/${created.employeeId}`} />}
                  nativeButton={false}
                >
                  View employee profile
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="crewDesignation">Crew designation</Label>
              <SearchableSelect
                id="crewDesignation"
                items={roleItems}
                value={selectedRoleCode}
                onValueChange={handleRoleChange}
                placeholder="Search designation (Master, Chief Engineer, …)"
                searchPlaceholder="Search by role or department…"
              />
            </div>

            {selectedRole ? (
              <div className="space-y-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Department:</span>{" "}
                  <strong>{selectedRole.department}</strong>
                  <span className="text-muted-foreground"> · {selectedRole.description}</span>
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  Vessel login ID format: {context.vessel.code}-
                  {getCrewRankLoginSuffix(selectedRole.roleCode)}
                  ## (e.g. {context.vessel.code}-{getCrewRankLoginSuffix(selectedRole.roleCode)}01)
                </p>
                {selectedRole.assignments.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Currently assigned on this vessel:</p>
                    {selectedRole.assignments.map((assignment) => (
                      <div key={assignment.employeeId} className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/employees/${assignment.employeeId}`}
                          className="font-medium hover:underline"
                        >
                          {assignment.name}
                        </Link>
                        <span className="font-mono text-xs text-muted-foreground">
                          {assignment.loginId}
                          {assignment.vesselLoginId ? ` · ${assignment.vesselLoginId}` : ""}
                        </span>
                        <EntityStatusBadge status={assignment.status as EntityStatus} />
                        {assignment.isWatchKeeper ? (
                          <Badge variant="secondary">Watch keeper</Badge>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Badge variant="outline">Vacant on this vessel</Badge>
                )}
              </div>
            ) : null}

            {selectedRole ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="crewFirstName">First name</Label>
                    <Input
                      id="crewFirstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="crewLastName">Last name</Label>
                    <Input
                      id="crewLastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="crewEmail">Email</Label>
                  <Input
                    id="crewEmail"
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

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={isWatchKeeper}
                    onCheckedChange={(checked) => setIsWatchKeeper(checked === true)}
                  />
                  Watch keeper on this vessel
                </label>
              </>
            ) : null}

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {selectedRole ? (
                <>
                  <Button type="submit" disabled={busy}>
                    {busy ? "Creating…" : "Create and activate"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <CrewCredentialsListPanel
        vesselId={vesselId}
        context={context}
        onChanged={() => void load({ silent: true })}
      />
    </div>
  );
}
