"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import type { RbacUserType } from "@prisma/client";
import { Anchor, Languages, Lock, Ship, Shield } from "lucide-react";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import {
  DEFAULT_SHIPYARD_QUOTE_LANG_PREFS,
  ensureShipyardQuoteLangPrefs,
  loadShipyardQuoteLangPrefs,
  resolveActiveLocale,
  saveShipyardQuoteLangPrefs,
  SHIPYARD_QUOTE_LOCALE_LABELS,
  SHIPYARD_QUOTE_SECONDARY_LOCALES,
  shipyardQuoteUi,
  type ShipyardQuoteLangPrefs,
  type ShipyardQuoteLocale,
  type ShipyardQuoteUiKey,
} from "@/lib/i18n/shipyardQuotationUi";

function DualLine({ primary, secondary }: { primary: string; secondary?: string }) {
  if (!secondary || secondary === primary) return <>{primary}</>;
  return (
    <span className="inline-flex flex-col leading-tight">
      <span>{primary}</span>
      <span className="text-[0.85em] font-normal opacity-75">{secondary}</span>
    </span>
  );
}

function useLoginI18n() {
  const [prefs, setPrefs] = useState<ShipyardQuoteLangPrefs>(DEFAULT_SHIPYARD_QUOTE_LANG_PREFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void ensureShipyardQuoteLangPrefs().then((loaded) => {
      if (cancelled) return;
      setPrefs(loaded);
      setReady(true);
    });
    const onLang = () => setPrefs(loadShipyardQuoteLangPrefs());
    window.addEventListener("actinium-shipyard-lang", onLang);
    return () => {
      cancelled = true;
      window.removeEventListener("actinium-shipyard-lang", onLang);
    };
  }, []);

  const locale = resolveActiveLocale(prefs);

  function t(key: ShipyardQuoteUiKey): string {
    return shipyardQuoteUi(locale, key);
  }

  function label(key: ShipyardQuoteUiKey): ReactNode {
    const primary = shipyardQuoteUi(locale, key);
    if (prefs.mode !== "dual") return primary;
    const other: ShipyardQuoteLocale = locale === "en" ? prefs.secondary : "en";
    const secondary = shipyardQuoteUi(other, key);
    return <DualLine primary={primary} secondary={secondary} />;
  }

  function update(next: ShipyardQuoteLangPrefs) {
    const normalized: ShipyardQuoteLangPrefs =
      next.mode === "en_only"
        ? { ...next, active: "en", autoDetected: false }
        : {
            ...next,
            active:
              next.active === "en" || next.active === next.secondary
                ? next.active
                : next.secondary,
            autoDetected: false,
          };
    setPrefs(normalized);
    saveShipyardQuoteLangPrefs(normalized);
  }

  return { prefs, ready, locale, t, label, update };
}

/** Compact top-right language control — English only, or dual with selected local language. */
function LoginLanguageDropdown({
  prefs,
  update,
}: {
  prefs: ShipyardQuoteLangPrefs;
  update: (next: ShipyardQuoteLangPrefs) => void;
}) {
  const selectValue =
    prefs.mode === "en_only" || prefs.active === "en" ? "en" : prefs.secondary;

  const items = [
    { value: "en", label: SHIPYARD_QUOTE_LOCALE_LABELS.en },
    ...SHIPYARD_QUOTE_SECONDARY_LOCALES.map((l) => ({
      value: l,
      label: SHIPYARD_QUOTE_LOCALE_LABELS[l],
    })),
  ];

  return (
    <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 sm:top-4 sm:right-4">
      <Languages className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <LabeledSelect
        id="login-language"
        items={items}
        value={selectValue}
        onValueChange={(v) => {
          if (v === "en") {
            update({
              ...prefs,
              mode: "en_only",
              active: "en",
            });
            return;
          }
          const secondary = (SHIPYARD_QUOTE_SECONDARY_LOCALES as string[]).includes(v)
            ? (v as Exclude<ShipyardQuoteLocale, "en">)
            : prefs.secondary;
          update({
            ...prefs,
            mode: "dual",
            secondary,
            active: secondary,
          });
        }}
        className="h-8 w-[9.5rem] border-muted-foreground/25 bg-background/90 py-0 text-xs shadow-sm"
      />
    </div>
  );
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
  const { prefs, ready, locale, t, label, update } = useLoginI18n();

  const infoMessage = useMemo(() => {
    if (reason === "timeout") return shipyardQuoteUi(locale, "loginTimeout");
    if (reason === "auth_required") return shipyardQuoteUi(locale, "loginAuthRequired");
    return null;
  }, [reason, locale]);

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
      setError(data.error ?? t("loginFailed"));
      return;
    }
    const data = (await res.json()) as {
      user?: { portalHome?: string; rbacUserType?: RbacUserType };
    };
    const rawNext = next?.trim() || "";
    const safeNext =
      rawNext &&
      !rawNext.startsWith("/login") &&
      !rawNext.includes("manifest") &&
      !/\.(webmanifest|ico|png|jpg|jpeg|svg|css|js)$/i.test(rawNext)
        ? rawNext
        : null;
    const destination = data.user?.portalHome ?? safeNext ?? "/projects";
    router.push(destination);
    router.refresh();
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <ActiniumLoadingState size="lg" label={t("loading")} />
      </div>
    );
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
              <p className="text-lg font-semibold tracking-tight">
                {label("loginBrandSubtitle")}
              </p>
            </div>
          </div>

          <div className="max-w-md space-y-4">
            <h1 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
              {label("loginHeroTitle")}
            </h1>
            <p className="text-sm leading-relaxed text-sky-100/80">{label("loginHeroBody")}</p>
          </div>

          <ul className="max-w-md space-y-4 text-sm text-sky-50/90">
            <li className="flex items-start gap-3">
              <Ship className="mt-0.5 size-4 shrink-0 text-sky-300" />
              <span>{label("loginBulletOffice")}</span>
            </li>
            <li className="flex items-start gap-3">
              <Anchor className="mt-0.5 size-4 shrink-0 text-sky-300" />
              <span>{label("loginBulletYard")}</span>
            </li>
            <li className="flex items-start gap-3">
              <Shield className="mt-0.5 size-4 shrink-0 text-sky-300" />
              <span>{label("loginBulletSession")}</span>
            </li>
          </ul>
        </div>

        <p className="relative z-10 px-10 pb-8 text-xs text-sky-200/50 xl:px-14">
          © {new Date().getFullYear()} Actinium · Secure maritime operations platform
        </p>
      </section>

      <section className="relative flex items-center justify-center bg-gradient-to-br from-slate-50 via-background to-sky-50/40 p-6 sm:p-10">
        <LoginLanguageDropdown prefs={prefs} update={update} />

        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center lg:text-left">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 lg:mx-0">
              <Lock className="size-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{label("loginSignIn")}</h2>
            <p className="text-sm text-muted-foreground">{label("loginSignInHint")}</p>
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

          <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm" lang="en">
            <div className="space-y-2">
              <Label htmlFor="loginId" className="block">
                {/* Dual-language label; input below stays English-only */}
                <span lang={locale}>{label("loginIdLabel")}</span>
              </Label>
              <Input
                id="loginId"
                lang="en"
                dir="ltr"
                inputMode="text"
                value={loginId}
                onChange={(e) =>
                  setLoginId(e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, ""))
                }
                placeholder={shipyardQuoteUi("en", "loginIdPlaceholder")}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                pattern="[A-Z0-9.]+"
                autoComplete="username"
                className="h-11 uppercase"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="block">
                <span lang={locale}>{label("loginPasswordLabel")}</span>
              </Label>
              <Input
                id="password"
                lang="en"
                dir="ltr"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={shipyardQuoteUi("en", "loginPasswordPlaceholder")}
                autoComplete="current-password"
                autoCorrect="off"
                spellCheck={false}
                className="h-11"
                required
              />
            </div>
            <Button type="submit" className="h-11 w-full text-base" disabled={loading} lang={locale}>
              {loading ? label("loginSubmitting") : label("loginSubmit")}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground lg:text-left">
            {label("loginProtected")}
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
