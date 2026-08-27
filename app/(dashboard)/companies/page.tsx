import { PageHeader } from "@/components/app-shell";
import { AddTargetButton } from "@/components/add-target-button";
import { CompaniesTable } from "@/components/companies-table";
import { EmptyDataState } from "@/components/empty-data-state";
import { requireUser } from "@/lib/auth/user";
import { listCompanies } from "@/lib/data/companies";
import { hasLiveDataBackend } from "@/lib/integrations/status";

export default async function CompaniesPage() {
  const user = await requireUser();
  const backendConfigured = hasLiveDataBackend();
  const companies = backendConfigured ? await listCompanies(user.workspaceId) : [];
  return (
    <div className="mx-auto max-w-[1700px] p-5 md:p-9">
      <PageHeader
        eyebrow="Target universe"
        title="Companies"
        description="Filter, compare, and move targets through the acquisition pipeline without losing provenance."
        action={backendConfigured ? <AddTargetButton workspaceId={user.workspaceId} /> : undefined}
      />
      {companies.length ? <CompaniesTable initialCompanies={companies} /> : <EmptyDataState />}
    </div>
  );
}
