import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ShipyardRegisterPage({
  title,
  description,
  columns,
}: {
  title: string;
  description: string;
  columns: string[];
}) {
  return (
    <PageShell>
      <PageHeader title={title} description={description} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Register scaffold</CardTitle>
          <CardDescription>
            Structured register ready for workshop updates — wire daily progress and collaboration flows here.
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto px-6 pb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {columns.map((col) => (
                  <th key={col} className="px-2 py-2 font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={columns.length} className="px-2 py-8 text-center text-muted-foreground">
                  No entries yet — linked from workshop job board and daily progress updates.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </PageShell>
  );
}
