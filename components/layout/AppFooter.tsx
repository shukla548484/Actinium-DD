import Link from "next/link";
import { Globe2, Mail, MapPin, Ship } from "lucide-react";
import { SITE_FOOTER } from "@/lib/site/footer";
import { cn } from "@/lib/utils";

type AppFooterProps = {
  className?: string;
  compact?: boolean;
};

export function AppFooter({ className, compact }: AppFooterProps) {
  const year = new Date().getFullYear();

  if (compact) {
    return (
      <footer
        className={cn(
          "mt-auto border-t border-zinc-800 bg-[#0b1f33] text-zinc-300",
          "px-4 py-4",
          className,
        )}
      >
        <div className="dd-content-width flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-white">
              <Ship className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-white">{SITE_FOOTER.companyName}</p>
              <p className="truncate text-xs text-zinc-400">{SITE_FOOTER.tagline}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <Link
              href={SITE_FOOTER.website.href}
              className="inline-flex items-center gap-1.5 text-zinc-300 transition-colors hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Globe2 className="size-3.5 shrink-0 opacity-80" aria-hidden />
              {SITE_FOOTER.website.label}
            </Link>
            <Link
              href={`mailto:${SITE_FOOTER.email}`}
              className="inline-flex items-center gap-1.5 text-zinc-300 transition-colors hover:text-white"
            >
              <Mail className="size-3.5 shrink-0 opacity-80" aria-hidden />
              {SITE_FOOTER.email}
            </Link>
            <span className="text-zinc-500">© {year}</span>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className={cn("mt-auto text-sm text-zinc-300", className)}>
      <div
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, var(--dd-rose) 0%, var(--dd-orange-bright) 45%, var(--dd-yellow-bright) 100%)",
        }}
        aria-hidden
      />
      <div className="border-t border-zinc-800 bg-[#0b1f33]">
        <div className="dd-content-width px-4 py-8 md:px-6 md:py-10">
          <div className="grid gap-8 md:grid-cols-12 md:gap-10">
            <div className="md:col-span-5 space-y-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-600/90 to-orange-600/80 text-white shadow-sm ring-1 ring-white/10">
                  <Ship className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-semibold tracking-tight text-white">
                    {SITE_FOOTER.companyName}
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-400">{SITE_FOOTER.tagline}</p>
                </div>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
                End-to-end dry dock planning, scope, and yard coordination for ship managers and
                technical superintendents.
              </p>
            </div>

            <div className="md:col-span-3 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Contact
              </p>
              <ul className="space-y-2.5">
                <li>
                  <Link
                    href={SITE_FOOTER.website.href}
                    className="group inline-flex items-start gap-2.5 text-zinc-300 transition-colors hover:text-white"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-white/5 text-orange-300 ring-1 ring-white/10 group-hover:bg-white/10">
                      <Globe2 className="size-3.5" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-xs text-zinc-500">Website</span>
                      <span className="font-medium text-zinc-100">{SITE_FOOTER.website.label}</span>
                    </span>
                  </Link>
                </li>
                <li>
                  <Link
                    href={`mailto:${SITE_FOOTER.email}`}
                    className="group inline-flex items-start gap-2.5 text-zinc-300 transition-colors hover:text-white"
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-white/5 text-rose-300 ring-1 ring-white/10 group-hover:bg-white/10">
                      <Mail className="size-3.5" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-xs text-zinc-500">Email</span>
                      <span className="font-medium text-zinc-100">{SITE_FOOTER.email}</span>
                    </span>
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {SITE_FOOTER.office.label}
              </p>
              <div className="flex items-start gap-2.5 rounded-lg bg-white/[0.04] p-3.5 ring-1 ring-white/10">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-white/5 text-yellow-300 ring-1 ring-white/10">
                  <MapPin className="size-3.5" aria-hidden />
                </span>
                <address className="not-italic leading-relaxed text-zinc-300">
                  {SITE_FOOTER.office.lines.map((line, index) => (
                    <span
                      key={line}
                      className={cn("block", index === 0 && "font-medium text-zinc-100")}
                    >
                      {line}
                    </span>
                  ))}
                </address>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500">
              © {year} {SITE_FOOTER.companyName}. All rights reserved.
            </p>
            <p className="text-xs text-zinc-500">
              Actinium Ship Management · Dry dock operations platform
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
