"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RbacUserType } from "@prisma/client";
import { Anchor, Lock, Ship, Shield } from "lucide-react";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

function reasonMessage(reason: string | null): string | null {
  if (reason === "timeout") {
    return "Your session ended after 20 minutes of inactivity. Please sign in again.";
  }
  if (reason === "auth_required") {
    return "Sign in to continue to Actinium-DD.";
  }
  return null;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const reason = searchParams.get("reason");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const infoMessage = useMemo(() => reasonMessage(reason), [reason]);

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
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-[#0b1f33] text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(56,189,248,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(14,165,233,0.12),transparent_50%)]" />
        <div className="relative z-10 flex flex-col gap-8 p-10 xl:p-14">
          <div className="flex items-center gap-3">
            <Image
              src="/actinium-sm-logo.png"
              alt="Actinium"
              width={44}
              height={44}
              className="rounded-lg bg-white/95 p-1"
              priority
            />
            <div>
              <p className="text-sm font-medium text-sky-200/90">Actinium-DD</p>
              <p className="text-lg font-semibold tracking-tight">Dry Dock Project Management</p>
            </div>
          </div>

          <div className="max-w-md space-y-4">
            <h1 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
              One secure login for every maritime workspace
            </h1>
            <p className="text-sm leading-relaxed text-sky-100/80">
              Tendering, superintendent planning, shipyard execution, vessel operations, and vendor
              collaboration — role-based access from a single front door.
            </p>
          </div>

          <ul className="max-w-md space-y-4 text-sm text-sky-50/90">
            <li className="flex items-start gap-3">
              <Ship className="mt-0.5 size-4 shrink-0 text-sky-300" />
              <span>Fleet, dry dock projects, and superintendent workspaces for office teams.</span>
            </li>
            <li className="flex items-start gap-3">
              <Anchor className="mt-0.5 size-4 shrink-0 text-sky-300" />
              <span>Shipyard and vessel portals scoped to assigned jobs and machinery.</span>
            </li>
            <li className="flex items-start gap-3">
              <Shield className="mt-0.5 size-4 shrink-0 text-sky-300" />
              <span>Sessions end automatically after 20 minutes of inactivity.</span>
            </li>
          </ul>
        </div>

        <p className="relative z-10 px-10 pb-8 text-xs text-sky-200/50 xl:px-14">
          © {new Date().getFullYear()} Actinium · Secure maritime operations platform
        </p>
      </section>

      <section className="flex items-center justify-center bg-gradient-to-br from-slate-50 via-background to-sky-50/40 p-6 sm:p-10">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center lg:text-left">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 lg:mx-0">
              <Lock className="size-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Enter your employee login ID and password. Your role determines which portal opens after
              sign-in.
            </p>
          </div>

          {infoMessage ? (
            <Alert>
              <AlertDescription>{infoMessage}</AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="loginId">Login ID</Label>
              <Input
                id="loginId"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="e.g. ACT.1001"
                autoComplete="username"
                className="h-11"
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
                className="h-11"
                required
              />
            </div>
            <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground lg:text-left">
            Protected environment · unauthorized access is prohibited
          </p>
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <ActiniumLoadingState size="lg" label="Loading Actinium-DD…" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
