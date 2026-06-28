import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

export const dynamic = "force-dynamic";

export default function AccountPasswordPage() {
  return (
    <PageShell>
      <PageHeader
        title="Change password"
        description="Update your sign-in password. Admins can also reset passwords from the employee profile."
      />
      <ChangePasswordForm />
    </PageShell>
  );
}
