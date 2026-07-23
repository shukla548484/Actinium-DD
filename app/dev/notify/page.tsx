"use client";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { notify } from "@/lib/notify";

export default function NotifyDemoPage() {
  return (
    <PageShell size="wide">
      <PageHeader
        title="App notifications"
        description="Activity messages for success, failure, alerts, approvals, and short self-dismissing notices."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Self-disappearing</CardTitle>
            <CardDescription>Auto-close after a few seconds.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => notify.short("Saved draft")}>
              Short notice
            </Button>
            <Button
              type="button"
              onClick={() =>
                notify.success("Assignment completed", {
                  description: "Modules and pages were updated for this employee.",
                })
              }
            >
              Success
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                notify.info("Sync queued", { description: "Fleet sync will run in the background." })
              }
            >
              Info
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                notify.warning("Missing vessel link", {
                  description: "Assign at least one vessel before continuing.",
                })
              }
            >
              Warning
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Errors & failures</CardTitle>
            <CardDescription>Shown when an activity fails.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                notify.error("Could not save", { description: "Network error. Try again." })
              }
            >
              Error
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                notify.failure("Import failed", {
                  description: "3 of 12 rows were rejected by validation.",
                })
              }
            >
              Failure
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sticky alert</CardTitle>
            <CardDescription>Stays until the user dismisses it.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() =>
                notify.alert("Budget overrun risk", {
                  description: "Quoted yard total exceeds approved budget by 8%.",
                  action: { label: "Review budget" },
                })
              }
            >
              Show alert
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval message</CardTitle>
            <CardDescription>Confirm / dismiss actions for approval-style flows.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() =>
                notify.approval("Approve module changes?", {
                  description: "Jhon Vick will receive Purchase and Tech Superintendent access.",
                  action: {
                    label: "Approve",
                    onClick: () => notify.success("Approved"),
                  },
                  secondaryAction: {
                    label: "Reject",
                    onClick: () => notify.short("Rejected"),
                  },
                })
              }
            >
              Approval prompt
            </Button>
            <Button type="button" variant="outline" onClick={() => notify.clear()}>
              Clear all
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
