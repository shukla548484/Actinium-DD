import Link from "next/link";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WORKSHOPS } from "@/lib/shipyard/workshops";

export default function WorkshopsOverviewPage() {
  return (
    <PageShell size="wide">
      <PageHeader
        title="Workshop overview"
        description="Each workshop manages its own job board, planning fields, and daily progress — with dependencies across teams."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {WORKSHOPS.map((w) => (
          <Card key={w.slug}>
            <CardHeader>
              <CardTitle className="text-base">{w.name}</CardTitle>
              <CardDescription>{w.typicalScope}</CardDescription>
              <Link href={`/shipyard/workshops/${w.slug}`} className="text-sm text-primary hover:underline">
                Open job board →
              </Link>
            </CardHeader>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
