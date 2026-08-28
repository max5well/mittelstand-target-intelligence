import "server-only";

import { createAdminClient } from "@/lib/db/admin";

export async function getCompanyEnrichmentEvidence(
  workspaceId: string,
  companyId: string,
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
      .limit(12),
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
  return {
    webSources: web.data ?? [],
    apollo: apollo.data,
  };
}
