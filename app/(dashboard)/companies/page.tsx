import { PageHeader } from "@/components/app-shell";
import { AddTargetButton } from "@/components/add-target-button";
import { CompaniesTable } from "@/components/companies-table";
import { EmptyDataState } from "@/components/empty-data-state";
import { requireUser } from "@/lib/auth/user";
import { listCompanies } from "@/lib/data/companies";
import { hasLiveDataBackend } from "@/lib/integrations/status";
import { companies as mockCompanies } from "@/lib/mock-data";

export default async function CompaniesPage() {
  const user = await requireUser();
  const backendConfigured = hasLiveDataBackend();
  const mockMode =
    process.env.MOCK_PROVIDERS !== "false" &&
    process.env.NODE_ENV !== "production";
  const companies = backendConfigured
    ? await listCompanies(user.workspaceId, user.id, { includeArchived: true })
    : mockMode
      ? mockCompanies
      : [];
  return (
    <div className="mx-auto max-w-[1700px] p-5 md:p-9">
      <PageHeader
        eyebrow="Zieluniversum"
        title="Unternehmen"
        description="Filtern, vergleichen und bewegen Sie Ziele durch die Akquisitionspipeline, ohne die Datenherkunft zu verlieren."
        action={
          backendConfigured ? (
            <AddTargetButton workspaceId={user.workspaceId} />
          ) : undefined
        }
      />
      {companies.length ? (
        <CompaniesTable
          initialCompanies={companies}
          workspaceId={user.workspaceId}
        />
      ) : (
        <EmptyDataState />
      )}
    </div>
  );
}
