import "server-only";

import { listCompanies } from "@/lib/data/companies";
import {
  formatSaleListingLocation,
  summarizeSaleListingDescription,
  summarizeSaleListingTitle,
} from "@/lib/sale-listings";
import type { SaleOpportunity } from "@/lib/types";

export async function listSaleOpportunities(
  workspaceId: string,
  userId: string,
): Promise<SaleOpportunity[]> {
  const companies = await listCompanies(workspaceId, userId, {
    includeArchived: true,
    saleListings: "only",
  });

  return companies.flatMap((company) => {
    const listing = company.saleListing;
    if (!listing?.active || !listing.sourceUrl) return [];
    return [
      {
        id: company.id,
        listingId: listing.listingId,
        title: summarizeSaleListingTitle(company.name, company.purpose),
        originalTitle: company.name,
        description: summarizeSaleListingDescription(
          company.name,
          company.purpose,
        ),
        location: formatSaleListingLocation(listing.location),
        industry: company.industry,
        employees: company.employees,
        revenueCents: company.revenueCents,
        ebitdaCents: company.ebitdaCents,
        askingPriceCents: listing.askingPriceCents,
        agentCompany:
          listing.provider === "concess"
            ? "con|cess M+A-Partner"
            : listing.providerLabel,
        sourceUrl: listing.sourceUrl,
        updatedAt: company.updatedAt,
      },
    ];
  });
}
