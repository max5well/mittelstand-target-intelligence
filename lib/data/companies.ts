import "server-only";

import { createAdminClient } from "@/lib/db/admin";
import {
  formatGermanRegisterCourt,
  formatGermanRegisterReference,
} from "@/lib/register";
import type { Company, OwnershipCategory, PipelineStatus } from "@/lib/types";
import { getWz2025IndustryName } from "@/lib/wz2025";

type Row = Record<string, unknown>;
const DATABASE_PAGE_SIZE = 500;
const COMPANY_ID_BATCH_SIZE = 100;

type PageResult<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

export async function fetchAllRows<T>(
  queryPage: (from: number, to: number) => PageResult<T>,
  label: string,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += DATABASE_PAGE_SIZE) {
    const { data, error } = await queryPage(
      from,
      from + DATABASE_PAGE_SIZE - 1,
    );
    if (error) throw new Error(`Unable to load ${label}: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < DATABASE_PAGE_SIZE) return rows;
  }
}

export async function fetchAllRowsByCompanyIds<T>(
  companyIds: string[],
  queryPage: (batch: string[], from: number, to: number) => PageResult<T>,
  label: string,
) {
  const rows: T[] = [];
  for (
    let offset = 0;
    offset < companyIds.length;
    offset += COMPANY_ID_BATCH_SIZE
  ) {
    const batch = companyIds.slice(offset, offset + COMPANY_ID_BATCH_SIZE);
    rows.push(
      ...(await fetchAllRows((from, to) => queryPage(batch, from, to), label)),
    );
  }
  return rows;
}

export async function listCompanies(
  workspaceId: string,
  userId: string,
  options: {
    includeArchived?: boolean;
    saleListings?: "exclude" | "only" | "include";
  } = {},
): Promise<Company[]> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (!process.env.SUPABASE_SECRET_KEY &&
      !process.env.SUPABASE_SERVER_ACCESS_TOKEN)
  )
    return [];
  const supabase = createAdminClient();
  const allCompanyRows = await fetchAllRows((from, to) => {
    let query = supabase
      .from("companies")
      .select("*")
      .eq("workspace_id", workspaceId);
    if (!options.includeArchived) query = query.neq("status", "archived");
    return query
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to);
  }, "companies");
  const saleListingMode = options.saleListings ?? "exclude";
  const companyRows = allCompanyRows.filter((row) => {
    const isSaleListing = Boolean(
      asRecord(asRecord(row.raw_provider_payload).sale_listing).listing_id,
    );
    if (saleListingMode === "include") return true;
    return saleListingMode === "only" ? isSaleListing : !isSaleListing;
  });
  if (!companyRows.length) return [];

  const ids = companyRows.map((row) => row.id);
  const [
    locations,
    financials,
    ownership,
    owners,
    management,
    scores,
    geocoding,
    favorites,
    apollo,
  ] = await Promise.all([
    fetchAllRowsByCompanyIds(
      ids,
      (companyIds, from, to) =>
        supabase
          .from("company_locations")
          .select("*")
          .in("company_id", companyIds)
          .order("retrieved_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      "company locations",
    ),
    fetchAllRowsByCompanyIds(
      ids,
      (companyIds, from, to) =>
        supabase
          .from("company_financial_periods")
          .select("*")
          .in("company_id", companyIds)
          .order("fiscal_period_end", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      "company financial periods",
    ),
    fetchAllRowsByCompanyIds(
      ids,
      (companyIds, from, to) =>
        supabase
          .from("company_ownership_classifications")
          .select("*")
          .in("company_id", companyIds)
          .eq("is_current", true)
          .order("id", { ascending: true })
          .range(from, to),
      "ownership classifications",
    ),
    fetchAllRowsByCompanyIds(
      ids,
      (companyIds, from, to) =>
        supabase
          .from("company_owners")
          .select("*")
          .in("company_id", companyIds)
          .order("ownership_percent", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      "company owners",
    ),
    fetchAllRowsByCompanyIds(
      ids,
      (companyIds, from, to) =>
        supabase
          .from("company_management")
          .select("*")
          .in("company_id", companyIds)
          .is("ended_on", null)
          .order("retrieved_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      "company management",
    ),
    fetchAllRowsByCompanyIds(
      ids,
      (companyIds, from, to) =>
        supabase
          .from("company_scores")
          .select("*")
          .in("company_id", companyIds)
          .order("calculated_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      "company scores",
    ),
    fetchAllRowsByCompanyIds(
      ids,
      (companyIds, from, to) =>
        supabase
          .from("geocoding_results")
          .select("*")
          .in("company_id", companyIds)
          .order("retrieved_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      "geocoding results",
    ),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("favorites")
          .select("company_id")
          .eq("workspace_id", workspaceId)
          .eq("user_id", userId)
          .order("id", { ascending: true })
          .range(from, to),
      "favorites",
    ),
    fetchAllRowsByCompanyIds(
      ids,
      (companyIds, from, to) =>
        supabase
          .from("apollo_organizations")
          .select("*")
          .in("company_id", companyIds)
          .order("retrieved_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      "Apollo organizations",
    ),
  ]);

  const firstByCompany = (rows: Row[] | null) => {
    const map = new Map<string, Row>();
    for (const row of rows ?? []) {
      const id = String(row.company_id);
      if (!map.has(id)) map.set(id, row);
    }
    return map;
  };
  const locationByCompany = firstByCompany(locations as Row[]);
  const financialByCompany = firstByCompany(financials as Row[]);
  const ownershipByCompany = firstByCompany(ownership as Row[]);
  const scoreByCompany = firstByCompany(scores as Row[]);
  const geoByCompany = firstByCompany(geocoding as Row[]);
  const apolloByCompany = firstByCompany(apollo as Row[]);
  const favoriteIds = new Set(favorites.map((row) => row.company_id));
  const groupByCompany = (rows: Row[] | null) => {
    const map = new Map<string, Row[]>();
    for (const row of rows ?? []) {
      const id = String(row.company_id);
      map.set(id, [...(map.get(id) ?? []), row]);
    }
    return map;
  };
  const ownersByCompany = groupByCompany(owners as Row[]);
  const managementByCompany = groupByCompany(management as Row[]);

  return companyRows.map((row) => {
    const id = row.id as string;
    const location = locationByCompany.get(id);
    const financial = financialByCompany.get(id);
    const classification = ownershipByCompany.get(id);
    const score = scoreByCompany.get(id);
    const geo = geoByCompany.get(id);
    const apolloOrganization = apolloByCompany.get(id);
    const payload = (row.raw_provider_payload ?? {}) as Row;
    const salePayload = asRecord(payload.sale_listing);
    const saleListing = salePayload.listing_id
      ? {
          active: salePayload.active !== false,
          provider: String(salePayload.provider ?? payload.source ?? "unknown"),
          providerLabel: String(
            salePayload.provider_label ?? salePayload.provider ?? "Quelle",
          ),
          listingId: String(salePayload.listing_id),
          sourceUrl: String(salePayload.source_url ?? ""),
          askingPriceCents:
            salePayload.asking_price_cents == null
              ? null
              : Number(salePayload.asking_price_cents),
          location:
            salePayload.location == null ? null : String(salePayload.location),
          retrievedAt: String(salePayload.retrieved_at ?? row.updated_at ?? ""),
        }
      : null;
    const register = (payload.register ?? {}) as Row;
    const industryCodes = payload.industry_codes;
    const wz2025 = asWzCodes(industryCodes);
    const industryCode = String(wz2025[0] ?? payload.industry_code ?? "N/A");
    const companyOwners = ownersByCompany.get(id) ?? [];
    const companyManagement = managementByCompany.get(id) ?? [];
    const capital = payload.capital as Row | undefined;
    const geoPayload = (geo?.raw_payload ?? {}) as Row;
    const geoAddress = (geoPayload.address ?? {}) as Row;
    const fiscalPeriod = financial?.fiscal_period_end
      ? new Date(String(financial.fiscal_period_end)).getUTCFullYear()
      : null;
    return {
      id,
      openregisterCompanyId: row.openregister_company_id,
      registerReference: formatGermanRegisterReference({
        registerType: String(
          register.register_type ?? payload.register_type ?? "",
        ),
        registerNumber: String(
          row.register_number ?? register.register_number ?? "",
        ),
        openregisterCompanyId: row.openregister_company_id,
      }),
      registerCourt: formatGermanRegisterCourt(
        String(register.register_court ?? payload.register_court ?? ""),
      ),
      name: row.legal_name,
      legalForm: row.legal_form ?? "N/A",
      address: String(location?.address_line ?? "N/A"),
      city: String(location?.city ?? "N/A"),
      state: String(location?.bundesland ?? geoAddress.state ?? "N/A"),
      postcode: String(location?.postcode ?? "N/A"),
      industryCode,
      industry:
        industryCode === "N/A"
          ? String(payload.industry_name ?? "N/A")
          : getWz2025IndustryName(industryCode),
      website: row.website_url,
      employees:
        financial?.employees == null
          ? payload.employees == null
            ? null
            : Number(payload.employees)
          : Number(financial.employees),
      employeeYear: fiscalPeriod,
      apolloEmployees:
        apolloOrganization?.estimated_employees == null
          ? null
          : Number(apolloOrganization.estimated_employees),
      revenueCents:
        financial?.revenue_cents == null
          ? payload.revenue_cents == null
            ? null
            : Number(payload.revenue_cents)
          : Number(financial.revenue_cents),
      ebitdaCents:
        financial?.ebitda_cents == null
          ? payload.ebitda_cents == null
            ? null
            : Number(payload.ebitda_cents)
          : Number(financial.ebitda_cents),
      ebitCents:
        financial?.ebit_cents == null
          ? payload.ebit_cents == null
            ? null
            : Number(payload.ebit_cents)
          : Number(financial.ebit_cents),
      equityCents:
        financial?.equity_cents == null ? null : Number(financial.equity_cents),
      debtCents:
        financial?.debt_cents == null ? null : Number(financial.debt_cents),
      totalAssetsCents:
        financial?.total_assets_cents == null
          ? null
          : Number(financial.total_assets_cents),
      fiscalYear: fiscalPeriod,
      financialRetrievedAt:
        financial?.retrieved_at == null ? null : String(financial.retrieved_at),
      ownership: String(
        classification?.classification ?? "Unknown",
      ) as OwnershipCategory,
      ownershipConfidence: Number(classification?.confidence ?? 0),
      ownershipMethod: (classification?.classification_method ??
        "manual") as Company["ownershipMethod"],
      ownerSummary: companyOwners.length
        ? companyOwners.map((owner) => String(owner.owner_name)).join(", ")
        : "N/A",
      owners: companyOwners.map((owner) => ({
        name: String(owner.owner_name),
        type: String(owner.owner_type ?? "N/A"),
        percentage:
          owner.ownership_percent == null
            ? null
            : Number(owner.ownership_percent),
      })),
      ownershipRetrievedAt:
        companyOwners[0]?.retrieved_at == null
          ? null
          : String(companyOwners[0].retrieved_at),
      management: companyManagement.map((person) => ({
        name: String(person.full_name),
        role: String(person.role),
      })),
      purpose: String(row.purpose ?? "N/A"),
      incorporationDate: row.incorporation_date,
      capitalCents:
        capital?.amount == null
          ? null
          : Math.round(Number(capital.amount) * 100),
      status: row.status as PipelineStatus,
      score: score?.insufficient_data
        ? null
        : score?.score == null
          ? null
          : Number(score.score),
      favorite: favoriteIds.has(id),
      hydration: [row.hydration_stage],
      latitude: geo?.latitude == null ? null : Number(geo.latitude),
      longitude: geo?.longitude == null ? null : Number(geo.longitude),
      updatedAt: row.updated_at,
      sourceType: "reported" as const,
      fictional: false,
      saleListing,
    };
  });
}

function asRecord(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
}

function asWzCodes(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (!value || typeof value !== "object") return [];
  const raw = (value as Row).WZ2025;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const code = item && typeof item === "object" ? (item as Row).code : item;
    return code == null ? [] : [String(code)];
  });
}

export async function getCompanyById(
  workspaceId: string,
  userId: string,
  companyId: string,
) {
  const companies = await listCompanies(workspaceId, userId, {
    includeArchived: true,
    saleListings: "include",
  });
  return companies.find((company) => company.id === companyId) ?? null;
}
