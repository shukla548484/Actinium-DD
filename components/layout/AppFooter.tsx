import Link from "next/link";
import { SITE_FOOTER } from "@/lib/site/footer";
import { cn } from "@/lib/utils";

type AppFooterProps = {
  className?: string;
  compact?: boolean;
};

export function AppFooter({ className, compact }: AppFooterProps) {
  return (
    <footer
      className={cn(
        "mt-auto border-t bg-muted/30 text-sm text-muted-foreground",
        compact ? "px-4 py-4" : "px-4 py-6 md:px-6",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-col gap-4",
          !compact && "md:flex-row md:items-start md:justify-between md:gap-8",
        )}
      >
        <div className="space-y-1">
          <p className="font-semibold text-foreground">{SITE_FOOTER.companyName}</p>
          <p>{SITE_FOOTER.tagline}</p>
          <p>
            Website:{" "}
            <Link
              href={SITE_FOOTER.website.href}
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {SITE_FOOTER.website.label}
            </Link>
          </p>
          <p>
            Email:{" "}
            <Link href={`mailto:${SITE_FOOTER.email}`} className="text-primary hover:underline">
              {SITE_FOOTER.email}
            </Link>
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-medium text-foreground">{SITE_FOOTER.office.label}</p>
          {SITE_FOOTER.office.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>

      <p className="mx-auto mt-4 max-w-6xl text-xs">
        © {new Date().getFullYear()} {SITE_FOOTER.companyName}. All rights reserved.
      </p>
    </footer>
  );
}
