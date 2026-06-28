"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_EMPLOYEE_PASSWORD, MIN_PASSWORD_LENGTH } from "@/lib/auth/constants";

type EmployeePasswordPanelProps = {
  employeeId: string;
  loginId: string;
  hasLogin: boolean;
};

function CreateLoginButton({ employeeId }: { employeeId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createLogin() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/admin/employees/${employeeId}/login`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create login account");
      return;
    }
    setMessage(
      `Login created. ID: ${data.loginId as string}, default password: ${DEFAULT_EMPLOYEE_PASSWORD}`,
    );
    window.location.reload();
  }

  return (
    <div className="space-y-2">
      <Alert>
        <AlertDescription>No login account yet for this employee.</AlertDescription>
      </Alert>
      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="button" disabled={busy} onClick={() => void createLogin()}>
        {busy ? "Creating…" : "Create login account"}
      </Button>
    </div>
  );
}

export function EmployeePasswordPanel({ employeeId, loginId, hasLogin }: EmployeePasswordPanelProps) {
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resetToDefault() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/admin/employees/${employeeId}/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetToDefault: true }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to reset password");
      return;
    }
    setMessage(`Password reset to default (${DEFAULT_EMPLOYEE_PASSWORD}).`);
    setNewPassword("");
  }

  async function setCustomPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setBusy(true);
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/admin/employees/${employeeId}/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to update password");
      return;
    }
    setMessage("Password updated.");
    setNewPassword("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Login credentials</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Employee login ID</span>
            <span className="font-mono font-medium">{loginId}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            New employees receive default password <strong>{DEFAULT_EMPLOYEE_PASSWORD}</strong>.
            They can change it from Account → Change password after signing in.
          </p>
        </div>

        {!hasLogin ? (
          <CreateLoginButton employeeId={employeeId} />
        ) : null}

        {message ? (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {hasLogin ? (
          <form onSubmit={(e) => void setCustomPassword(e)} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="adminNewPassword">Set new password (admin)</Label>
              <Input
                id="adminNewPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder={`Min ${MIN_PASSWORD_LENGTH} characters`}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="outline" disabled={busy || !newPassword}>
                Update password
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void resetToDefault()}>
                Reset to default
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
