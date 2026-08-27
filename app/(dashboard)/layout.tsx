import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  return <AppShell userEmail={user.email}>{children}</AppShell>;
}
