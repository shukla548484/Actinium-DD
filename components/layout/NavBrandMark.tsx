"use client";

import Image from "next/image";
import Link from "next/link";
import { ACTINIUM_PRODUCT_LOGO, resolveNavCompanyLogoSrc } from "@/lib/nav-brand-logo";

type NavBrandCompany = {
  name?: string | null;
  logoUrl?: string | null;
} | null;

export function NavBrandMark({
  homeHref = "/projects",
  company,
}: {
  homeHref?: string;
  company?: NavBrandCompany;
}) {
  const companyLogoSrc = resolveNavCompanyLogoSrc(company?.logoUrl);
  const companyName = company?.name?.trim();

  return (
    <Link
      href={homeHref}
      className="flex min-w-0 shrink-0 items-center gap-2.5 transition-opacity hover:opacity-90"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-sidebar-accent/30">
        {companyLogoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={companyLogoSrc}
            alt={companyName ? `${companyName} logo` : "Company logo"}
            className="h-full w-full object-contain p-0.5"
          />
        ) : (
          <Image
            src={ACTINIUM_PRODUCT_LOGO}
            alt="Actinium-DD"
            width={40}
            height={40}
            className="h-9 w-9 object-contain"
            priority
            unoptimized
          />
        )}
      </div>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-xl font-bold tracking-tight text-sidebar-foreground drop-shadow-[0_1px_0_rgba(255,255,255,0.2)]">
          Actinium-DD
        </span>
        {companyName ? (
          <span
            className="max-w-[220px] truncate text-[10px] font-medium text-sidebar-foreground/75"
            title={companyName}
          >
            {companyName}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
