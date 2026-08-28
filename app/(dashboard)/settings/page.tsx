import { PageHeader } from "@/components/app-shell";
import { SettingsPanel } from "@/components/settings-panel";
import { getIntegrationStatuses } from "@/lib/integrations/status";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  return (
    <div className="mx-auto max-w-[1200px] p-5 md:p-9">
      <PageHeader
        eyebrow="Administration"
        title="Einstellungen"
        description="Verwalten Sie Zugriff, Datenintegrationen, Scoring, Datenschutz und Aufbewahrung."
      />
      <SettingsPanel
        integrations={getIntegrationStatuses()}
        initialSection={
          section === "integrations" ? "Integrationen" : "Arbeitsbereich"
        }
      />
    </div>
  );
}
