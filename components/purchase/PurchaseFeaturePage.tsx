import Link from "next/link";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type RelatedLink = { href: string; label: string };

/**
 * Actinium shell for PMS purchase screens while full UI/API port completes.
 * Source: vendor/pms-purchase-source/app-purchase (copied from app-pms-updated).
 */
export function PurchaseFeaturePage({
  title,
  description,
  sourcePath,
  features,
  related = [],
  status = "ported-shell",
}: {
  title: string;
  description: string;
  sourcePath: string;
  features: string[];
  related?: RelatedLink[];
  status?: "live" | "ported-shell" | "partial";
}) {
  return (
    <PageShell size="wide">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Badge variant={status === "live" ? "default" : "secondary"}>
            {status === "live" ? "Live" : status === "partial" ? "Partial" : "PMS source ready"}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Module capabilities</CardTitle>
            <CardDescription>
              Copied from app-pms-updated purchase module. UI is being adapted to Actinium auth,
              RBAC, and Base UI components; full interactive screens land in follow-up updates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1.5 text-sm text-muted-foreground">
              {features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Source & next steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Reference implementation:{" "}
              <code className="text-xs text-foreground">{sourcePath}</code>
            </p>
            <p>APIs, Prisma models, and hooks are staged under <code className="text-xs">vendor/pms-purchase-source/</code> and <code className="text-xs">lib/purchase/</code>.</p>
            {related.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {related.map((r) => (
                  <Button
                    key={r.href}
                    size="sm"
                    variant="outline"
                    render={<Link href={r.href} />}
                    nativeButton={false}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
