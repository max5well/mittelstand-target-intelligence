import "server-only";

import { createAdminClient } from "@/lib/db/admin";
import type { Company, OwnershipCategory, PipelineStatus } from "@/lib/types";

type Row = Record<string, unknown>;

export async function listCompanies(workspaceId: string): Promise<Company[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVER_ACCESS_TOKEN)) return [];
  const supabase = createAdminClient();
  const { data: companyRows, error } = await supabase
    .from("companies")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Unable to load companies: ${error.message}`);
  if (!companyRows?.length) return [];

  const ids = companyRows.map((row) => row.id);
  const [locations, financials, ownership, scores, geocoding, favorites, apollo] = await Promise.all([
    supabase.from("company_locations").select("*").in("company_id", ids).order("retrieved_at", { ascending: false }),
    supabase.from("company_financial_periods").select("*").in("company_id", ids).order("fiscal_period_end", { ascending: false }),
    supabase.from("company_ownership_classifications").select("*").in("company_id", ids).eq("is_current", true),
    supabase.from("company_scores").select("*").in("company_id", ids).order("calculated_at", { ascending: false }),
    supabase.from("geocoding_results").select("*").in("company_id", ids).order("retrieved_at", { ascending: false }),
    supabase.from("favorites").select("company_id").eq("workspace_id", workspaceId),
    supabase.from("apollo_organizations").select("*").in("company_id", ids).order("retrieved_at", { ascending: false }),
  ]);

  const firstByCompany = (rows: Row[] | null) => {
    const map = new Map<string, Row>();
    for (const row of rows ?? []) {
      const id = String(row.company_id);
      if (!map.has(id)) map.set(id, row);
    }
    return map;
  };
  const locationByCompany = firstByCompany(locations.data as Row[] | null);
  const financialByCompany = firstByCompany(financials.data as Row[] | null);
  const ownershipByCompany = firstByCompany(ownership.data as Row[] | null);
  const scoreByCompany = firstByCompany(scores.data as Row[] | null);
  const geoByCompany = firstByCompany(geocoding.data as Row[] | null);
  const apolloByCompany = firstByCompany(apollo.data as Row[] | null);
  const favoriteIds = new Set((favorites.data ?? []).map((row) => row.company_id));

  return companyRows.map((row) => {
    const id = row.id as string;
    const location = locationByCompany.get(id);
    const financial = financialByCompany.get(id);
    const classification = ownershipByCompany.get(id);
    const score = scoreByCompany.get(id);
    const geo = geoByCompany.get(id);
    const apolloOrganization = apolloByCompany.get(id);
    const payload = (row.raw_provider_payload ?? {}) as Row;
    const industryCodes = Array.isArray(payload.industry_codes) ? payload.industry_codes : [];
    const industryCode = String(industryCodes[0] ?? payload.industry_code ?? "N/A");
    const fiscalPeriod = financial?.fiscal_period_end ? new Date(String(financial.fiscal_period_end)).getUTCFullYear() : null;
    return {
      id,
      openregisterCompanyId: row.openregister_company_id,
      name: row.legal_name,
      legalForm: row.legal_form ?? "N/A",
      city: String(location?.city ?? "N/A"),
      state: String(location?.bundesland ?? "N/A"),
      postcode: String(location?.postcode ?? "N/A"),
      industryCode,
      industry: String(payload.industry_name ?? payload.industry ?? "N/A"),
      website: row.website_url,
      employees: financial?.employees == null ? null : Number(financial.employees),
      employeeYear: fiscalPeriod,
      apolloEmployees: apolloOrganization?.estimated_employees == null ? null : Number(apolloOrganization.estimated_employees),
      revenueCents: financial?.revenue_cents == null ? null : Number(financial.revenue_cents),
      ebitdaCents: financial?.ebitda_cents == null ? null : Number(financial.ebitda_cents),
      fiscalYear: fiscalPeriod,
      ownership: String(classification?.classification ?? "Unknown") as OwnershipCategory,
      ownershipConfidence: Number(classification?.confidence ?? 0),
      ownershipMethod: (classification?.classification_method ?? "manual") as Company["ownershipMethod"],
      ownerSummary: String(payload.owner_summary ?? "N/A"),
      status: row.status as PipelineStatus,
      score: score?.insufficient_data ? null : score?.score == null ? null : Number(score.score),
      favorite: favoriteIds.has(id),
      hydration: [row.hydration_stage],
      latitude: geo?.latitude == null ? null : Number(geo.latitude),
      longitude: geo?.longitude == null ? null : Number(geo.longitude),
      updatedAt: row.updated_at,
      sourceType: "reported" as const,
      fictional: false,
    };
  });
}

export async function getCompanyById(workspaceId: string, companyId: string) {
  const companies = await listCompanies(workspaceId);
  return companies.find((company) => company.id === companyId) ?? null;
}
