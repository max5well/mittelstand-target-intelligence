import "server-only";

import { createAdminClient } from "@/lib/db/admin";
import { isSameWebsiteUrl } from "@/lib/url-safety";

export async function getCompanyEnrichmentEvidence(
  workspaceId: string,
  companyId: string,
  verifiedWebsite?: string | null,
) {
  const supabase = createAdminClient();
  const [web, apollo] = await Promise.all([
    supabase
      .from("web_sources")
      .select(
        "id,provider,url,title,publication_date,supporting_excerpt,retrieved_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("company_id", companyId)
      .order("retrieved_at", { ascending: false })
      .limit(50),
    supabase
      .from("apollo_organizations")
      .select(
        "apollo_id,domain,country,estimated_employees,estimated_revenue_cents,retrieved_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("company_id", companyId)
      .order("retrieved_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (web.error)
    throw new Error(`Unable to load web evidence: ${web.error.message}`);
  if (apollo.error)
    throw new Error(`Unable to load Apollo evidence: ${apollo.error.message}`);
  const deduplicatedWebSources = (web.data ?? []).filter(
    (source, index, sources) =>
      sources.findIndex((candidate) => candidate.url === source.url) === index,
  );
  return {
    webSources: deduplicatedWebSources
      .filter(
        (source) =>
          !verifiedWebsite || !isSameWebsiteUrl(source.url, verifiedWebsite),
      )
      .slice(0, 12),
    copilotWebSources: deduplicatedWebSources.slice(0, 12),
    apollo: apollo.data,
  };
}

export async function getCompanyCopilotEvidence(
  workspaceId: string,
  companyId: string,
  verifiedWebsite?: string | null,
) {
  const supabase = createAdminClient();
  const [evidence, financialPeriods, companySources] = await Promise.all([
    getCompanyEnrichmentEvidence(workspaceId, companyId, verifiedWebsite),
    supabase
      .from("company_financial_periods")
      .select(
        "fiscal_period_end,consolidated,currency,revenue_cents,ebitda_cents,ebit_cents,net_income_cents,equity_cents,cash_cents,debt_cents,total_assets_cents,employees,source_provider,source_identifier,retrieved_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("company_id", companyId)
      .order("fiscal_period_end", { ascending: false })
      .limit(5),
    supabase
      .from("company_sources")
      .select("provider,source_identifier,source_url,source_date,retrieved_at")
      .eq("workspace_id", workspaceId)
      .eq("company_id", companyId)
      .order("retrieved_at", { ascending: false })
      .limit(12),
  ]);
  if (financialPeriods.error)
    throw new Error(
      `Unable to load financial history: ${financialPeriods.error.message}`,
    );
  if (companySources.error)
    throw new Error(
      `Unable to load company provenance: ${companySources.error.message}`,
    );
  return {
    ...evidence,
    financialPeriods: financialPeriods.data ?? [],
    companySources: companySources.data ?? [],
  };
}
