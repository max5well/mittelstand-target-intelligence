import { PageHeader } from "@/components/app-shell";
import { GermanyMap } from "@/components/germany-map";
import { EmptyDataState } from "@/components/empty-data-state";
import { requireUser } from "@/lib/auth/user";
import { listCompanies } from "@/lib/data/companies";
import { hasLiveDataBackend } from "@/lib/integrations/status";

export default async function MapPage() {
  const user = await requireUser();
  const companies = hasLiveDataBackend() ? await listCompanies(user.workspaceId) : [];
  return (
    <div className="mx-auto max-w-[1500px] p-5 md:p-9">
      <PageHeader
        eyebrow="Spatial intelligence"
        title="Germany map"
        description="Explore clustered targets by geography while preserving the active company filters."
      />
      {companies.some((company) => company.latitude !== null && company.longitude !== null) ? (
        <div className="mt-6"><GermanyMap companies={companies} /></div>
      ) : (
        <EmptyDataState title="No mapped companies yet" description="A real map will appear after live companies have verified coordinates. No placeholder markers are displayed." />
      )}
    </div>
  );
}
