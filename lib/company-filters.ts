import type { Company, OwnershipCategory, PipelineStatus } from "@/lib/types";

export type CompanyFilters = {
  query: string;
  status: PipelineStatus | "all";
  favoritesOnly: boolean;
  state: string;
  city: string;
  industry: string;
  ownership: OwnershipCategory | "all";
};

export function filterCompanies(
  companies: Company[],
  filters: CompanyFilters,
): Company[] {
  const term = filters.query.toLocaleLowerCase("de");
  return companies.filter((company) => {
    const matchesQuery = [
      company.name,
      company.city,
      company.state,
      company.industry,
      company.openregisterCompanyId,
      company.ownerSummary,
    ].some((value) => value.toLocaleLowerCase("de").includes(term));

    return (
      matchesQuery &&
      (filters.status === "all" || company.status === filters.status) &&
      (!filters.favoritesOnly || company.favorite) &&
      (filters.state === "all" || company.state === filters.state) &&
      (filters.city === "all" || company.city === filters.city) &&
      (filters.industry === "all" || company.industry === filters.industry) &&
      (filters.ownership === "all" || company.ownership === filters.ownership)
    );
  });
}
