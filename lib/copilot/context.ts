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
    financialPeriods?: Array<Record<string, unknown>>;
    companySources?: Array<Record<string, unknown>>;
    copilotWebSources?: Array<{
      provider: string;
      url: string;
      title: string | null;
      supporting_excerpt: string | null;
      retrieved_at: string | null;
    }>;
  },
) {
  return {
    identity: {
      id: company.id,
      legalName: company.name,
      legalForm: company.legalForm,
      registerReference: company.registerReference,
      registerCourt: company.registerCourt,
      openregisterCompanyId: company.openregisterCompanyId,
      address: company.address,
      postcode: company.postcode,
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
      employeeYear: company.employeeYear,
      apolloEmployees: company.apolloEmployees,
    },
    financials: {
      fiscalYear: company.fiscalYear,
      revenueCents: company.revenueCents,
      ebitdaCents: company.ebitdaCents,
      ebitCents: company.ebitCents,
      equityCents: company.equityCents,
      debtCents: company.debtCents,
      totalAssetsCents: company.totalAssetsCents,
      capitalCents: company.capitalCents,
      retrievedAt: company.financialRetrievedAt,
      scope:
        "registered local entity unless a source explicitly states otherwise",
      history: evidence.financialPeriods ?? [],
    },
    ownership: {
      category: company.ownership,
      confidence: company.ownershipConfidence,
      method: company.ownershipMethod,
      retrievedAt: company.ownershipRetrievedAt,
      summary: company.ownerSummary,
      owners: company.owners,
      management: company.management,
    },
    existingExternalEvidence: (
      evidence.copilotWebSources ?? evidence.webSources
    )
      .slice(0, 8)
      .map((source) => ({
        provider: source.provider,
        url: source.url,
        title: source.title,
        excerpt: source.supporting_excerpt,
        retrievedAt: source.retrieved_at,
      })),
    provenance: evidence.companySources ?? [],
    apolloEstimate: evidence.apollo,
    dossierState: {
      pipelineStatus: company.status,
      investmentScore: company.score,
      hydration: company.hydration,
      sourceType: company.sourceType,
      lastUpdatedAt: company.updatedAt,
    },
  };
}
