import { PageHeader } from "@/components/app-shell";
import { SettingsPanel } from "@/components/settings-panel";
import { getIntegrationStatuses } from "@/lib/integrations/status";
import { requireUser } from "@/lib/auth/user";
import { getProviderHealth } from "@/lib/data/jobs";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const [{ section }, user] = await Promise.all([searchParams, requireUser()]);
  const health = await getProviderHealth(user.workspaceId);
  return (
    <div className="mx-auto max-w-[1200px] p-5 md:p-9">
      <PageHeader
        eyebrow="Administration"
        title="Einstellungen"
        description="Verwalten Sie Zugriff, Datenintegrationen, Scoring, Datenschutz und Aufbewahrung."
      />
      <SettingsPanel
        integrations={getIntegrationStatuses(health)}
        initialSection={
          section === "integrations" ? "Integrationen" : "Arbeitsbereich"
        }
      />
    </div>
  );
}
