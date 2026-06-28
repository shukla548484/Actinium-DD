"use client";

import Link from "next/link";
import { EntityListPage } from "@/components/superintendent/EntityListPage";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";


export const dynamic = "force-dynamic";

type Row = {
  id: string;
  partName: string; partNumber: string | null; quantity: number; supplyType: string; status: string; requiredDate: string | null; notes: string | null;
};

export default function ListPage() {
  return (
    <PageShell>
      <PageHeader
        title="Spares & stores"
        description="Required parts and delivery status."
        actions={
          <Button render={<Link href="/superintendent/spares/new" />} nativeButton={false}>
            Add
          </Button>
        }
      />
      <EntityListPage<Row>
        title="Spares items"
        description="Required parts and delivery status."
        apiPath="/api/superintendent/spares"
        newHref="/superintendent/spares/new"
        editHref={(id) => `/superintendent/spares/${id}/edit`}
        searchParam=""
        columns={[
          { header: "Part name", cell: (row) => row.partName },
          { header: "Quantity", cell: (row) => row.quantity },
          { header: "Status", cell: (row) => row.status },
        ]}
      />
    </PageShell>
  );
}
