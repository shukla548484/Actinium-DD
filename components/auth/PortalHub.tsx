import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PORTAL_HUB_ENTRIES } from "@/lib/navigation/buildPortalNav";
import { RBAC_USER_TYPE_DESCRIPTIONS } from "@/lib/rbac/userTypes";

export function PortalHub() {
  return (
    <main className="dd-content-scroll bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 md:px-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Actinium-DD</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Dry dock project management across five user types. Sign in with your assigned Login ID
            to reach your portal, or explore portal entry points below when authentication is
            disabled for local development.
          </p>
          <Button render={<Link href="/login" />} nativeButton={false}>
            Sign in
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PORTAL_HUB_ENTRIES.map((portal) => {
            const Icon = portal.icon;
            return (
              <Card key={portal.userType} className="flex flex-col">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <CardTitle className="text-lg">{portal.title}</CardTitle>
                  <CardDescription>
                    {RBAC_USER_TYPE_DESCRIPTIONS[portal.userType]}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button
                    variant="outline"
                    className="w-full"
                    render={<Link href={portal.href} />}
                    nativeButton={false}
                  >
                    Open {portal.title} portal
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
