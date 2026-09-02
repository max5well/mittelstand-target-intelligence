import type { Company } from "@/lib/types";

export type CopilotCompanyContext = ReturnType<typeof compileCompanyContext>;

export function compileCompanyContext(
  company: Company,
  evidence: {
    webSources: Array<{
      provider: string;
      url: string;
      title: string | null;
      supporting_excerpt: string | null;
      retrieved_at: string | null;
    }>;
    apollo: Record<string, unknown> | null;
  },
) {
  return {
    identity: {
      id: company.id,
      legalName: company.name,
      registerReference: company.registerReference,
      registerCourt: company.registerCourt,
      city: company.city,
      state: company.state,
      website: company.website,
      incorporationDate: company.incorporationDate,
    },
    business: {
      industry: company.industry,
      industryCode: company.industryCode,
      purpose: company.purpose,
      employees: company.employees,
    },
    financials: {
      fiscalYear: company.fiscalYear,
      revenueCents: company.revenueCents,
      ebitdaCents: company.ebitdaCents,
      ebitCents: company.ebitCents,
      equityCents: company.equityCents,
      debtCents: company.debtCents,
      totalAssetsCents: company.totalAssetsCents,
    },
    ownership: {
      category: company.ownership,
      confidence: company.ownershipConfidence,
      summary: company.ownerSummary,
      owners: company.owners,
      management: company.management,
    },
    existingExternalEvidence: evidence.webSources.slice(0, 8).map((source) => ({
      provider: source.provider,
      url: source.url,
      title: source.title,
      excerpt: source.supporting_excerpt,
      retrievedAt: source.retrieved_at,
    })),
    apolloEstimate: evidence.apollo,
  };
}
