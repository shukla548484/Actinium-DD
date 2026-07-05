"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_EMPLOYEE_PASSWORD } from "@/lib/auth/constants";
import type { RbacUserType } from "@prisma/client";
import { RBAC_USER_TYPE_DESCRIPTIONS } from "@/lib/rbac/userTypes";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Sign in failed.");
      return;
    }
    const data = (await res.json()) as {
      user?: { portalHome?: string; rbacUserType?: RbacUserType };
    };
    const destination = data.user?.portalHome ?? next ?? "/projects";
    router.push(destination);
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4 md:p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Sign in</CardTitle>
          <CardDescription>
            One login for all portals. Your role determines which workspace you reach after sign-in.
            Default password is <strong>{DEFAULT_EMPLOYEE_PASSWORD}</strong> until changed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground sm:grid-cols-2">
            {(Object.keys(RBAC_USER_TYPE_DESCRIPTIONS) as RbacUserType[]).map((type) => (
              <div key={type}>
                <strong className="text-foreground capitalize">{type}</strong>:{" "}
                {RBAC_USER_TYPE_DESCRIPTIONS[type]}
              </div>
            ))}
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loginId">Login ID</Label>
              <Input
                id="loginId"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Office: ABC.0001 · Crew: AAA-BBB-CE01"
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
