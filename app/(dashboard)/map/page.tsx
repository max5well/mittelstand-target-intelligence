import { PageHeader } from "@/components/app-shell";
import { GermanyMap } from "@/components/germany-map";
import { EmptyDataState } from "@/components/empty-data-state";
import { requireUser } from "@/lib/auth/user";
import { listCompanies } from "@/lib/data/companies";
import { hasLiveDataBackend } from "@/lib/integrations/status";

export default async function MapPage() {
  const user = await requireUser();
  const companies = hasLiveDataBackend()
    ? await listCompanies(user.workspaceId)
    : [];
  return (
    <div className="mx-auto max-w-[1500px] p-5 md:p-9">
      <PageHeader
        eyebrow="Geografische Intelligence"
        title="Deutschlandkarte"
        description="Erkunden Sie gruppierte Zielunternehmen nach Region, ohne die aktiven Unternehmensfilter zu verändern."
      />
      {companies.some(
        (company) => company.latitude !== null && company.longitude !== null,
      ) ? (
        <div className="mt-6">
          <GermanyMap companies={companies} />
        </div>
      ) : (
        <EmptyDataState
          title="Noch keine Unternehmen auf der Karte"
          description="Die Karte erscheint, sobald Live-Unternehmen verifizierte Koordinaten besitzen. Es werden keine Platzhalter-Markierungen angezeigt."
        />
      )}
    </div>
  );
}
