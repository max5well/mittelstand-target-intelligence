import { AppShell } from "@/components/app-shell";
import { isEvalAdminEmail } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  return (
    <AppShell
      userEmail={user.email}
      canAccessEvalConsole={isEvalAdminEmail(user.email)}
    >
      {children}
    </AppShell>
  );
}
