import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { CompaniesTable } from "@/components/companies-table";
import { companies, fictionalNotice } from "@/lib/mock-data";

export default function CompaniesPage() {
  return (
    <div className="mx-auto max-w-[1700px] p-5 md:p-9">
      <PageHeader
        eyebrow="Target universe"
        title="Companies"
        description="Filter, compare, and move targets through the acquisition pipeline without losing provenance."
        action={
          <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#13201d] px-4 text-sm font-medium text-white">
            <Plus size={15} /> Add target
          </button>
        }
      />
      <p className="mt-4 text-[11px] text-[#6a746f]">{fictionalNotice}</p>
      <CompaniesTable initialCompanies={companies} />
    </div>
  );
}
