import "server-only";

import { createAdminClient } from "@/lib/db/admin";

export type PublicSaleListing = {
  listingId: string;
  title: string;
  description: string;
  industry: string | null;
  tags: string[];
  location: string | null;
  countryCode: "DE";
  revenueCents: number | null;
  ebitCents: number | null;
  ebitdaCents: number | null;
  askingPriceCents: number | null;
  employees: number | null;
  foundedYear: number | null;
  sourceUrl: string;
};

export type PublicSaleListingFetchResult = {
  listings: PublicSaleListing[];
  totalOffers: number;
  excludedNonGerman: number;
  pagesFetched: number;
};

type ImportOptions = {
  workspaceId: string;
  provider: string;
  providerLabel: string;
  fetched: PublicSaleListingFetchResult;
};

type Row = Record<string, unknown>;

export async function importPublicSaleListings({
  workspaceId,
  provider,
  providerLabel,
  fetched,
}: ImportOptions) {
  const supabase = createAdminClient();
  const externalIds = fetched.listings.map((listing) =>
    toExternalId(provider, listing),
  );
  const { data: existingRows, error: existingError } = await supabase
    .from("companies")
    .select("id,openregister_company_id,raw_provider_payload")
    .eq("workspace_id", workspaceId)
    .like("openregister_company_id", `${provider}:%`);
  if (existingError) throw new Error(existingError.message);

  const existingByExternalId = new Map(
    (existingRows ?? []).map((row) => [row.openregister_company_id, row]),
  );
  const now = new Date().toISOString();
  const companyRows = fetched.listings.map((listing) => ({
    workspace_id: workspaceId,
    openregister_company_id: toExternalId(provider, listing),
    legal_name: listing.title,
    legal_form: null,
    purpose: listing.description || null,
    raw_provider_payload: toProviderPayload(
      provider,
      providerLabel,
      listing,
      now,
    ),
    updated_at: now,
  }));
  const { data: persisted, error: companyError } = companyRows.length
    ? await supabase
        .from("companies")
        .upsert(companyRows, {
          onConflict: "workspace_id,openregister_company_id",
        })
        .select("id,openregister_company_id")
    : { data: [], error: null };
  if (companyError) throw new Error(companyError.message);

  const companyByExternalId = new Map(
    (persisted ?? []).map((row) => [row.openregister_company_id, row.id]),
  );
  const currentCompanyIds = Array.from(companyByExternalId.values());
  const [
    { data: currentLocations, error: locationsReadError },
    { data: currentSources, error: sourcesReadError },
  ] = currentCompanyIds.length
    ? await Promise.all([
        supabase
          .from("company_locations")
          .select("company_id,source_identifier")
          .eq("workspace_id", workspaceId)
          .eq("source_provider", provider)
          .in("company_id", currentCompanyIds),
        supabase
          .from("company_sources")
          .select("company_id,source_identifier")
          .eq("workspace_id", workspaceId)
          .eq("provider", provider)
          .in("company_id", currentCompanyIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (locationsReadError) throw new Error(locationsReadError.message);
  if (sourcesReadError) throw new Error(sourcesReadError.message);

  const newListings = fetched.listings.filter(
    (listing) => !existingByExternalId.has(toExternalId(provider, listing)),
  );
  const locationCompanyIds = new Set(
    (currentLocations ?? []).map((row) => row.company_id),
  );
  const sourceCompanyIds = new Set(
    (currentSources ?? []).map((row) => row.company_id),
  );
  const locationRows = fetched.listings.flatMap((listing) => {
    const companyId = companyByExternalId.get(toExternalId(provider, listing));
    if (!companyId || locationCompanyIds.has(companyId)) return [];
    return [
      {
        workspace_id: workspaceId,
        company_id: companyId,
        city: listing.location ?? "Deutschland",
        bundesland: null,
        country_code: "DE",
        is_registered: false,
        source_provider: provider,
        source_identifier: listing.listingId,
        retrieved_at: now,
      },
    ];
  });
  const sourceRows = fetched.listings.flatMap((listing) => {
    const companyId = companyByExternalId.get(toExternalId(provider, listing));
    if (!companyId || sourceCompanyIds.has(companyId)) return [];
    return [
      {
        workspace_id: workspaceId,
        company_id: companyId,
        provider,
        source_identifier: listing.listingId,
        source_url: listing.sourceUrl,
        retrieved_at: now,
        raw_payload: listing,
      },
    ];
  });
  const [{ error: locationError }, { error: sourceError }] = await Promise.all([
    locationRows.length
      ? supabase.from("company_locations").insert(locationRows)
      : Promise.resolve({ error: null }),
    sourceRows.length
      ? supabase.from("company_sources").insert(sourceRows)
      : Promise.resolve({ error: null }),
  ]);
  if (locationError) throw new Error(locationError.message);
  if (sourceError) throw new Error(sourceError.message);

  const currentIds = new Set(externalIds);
  const staleRows = (existingRows ?? []).filter(
    (row) => !currentIds.has(row.openregister_company_id),
  );
  const staleUpdates = await Promise.all(
    staleRows.map((row) => {
      const payload = asRecord(row.raw_provider_payload);
      const saleListing = asRecord(payload.sale_listing);
      return supabase
        .from("companies")
        .update({
          raw_provider_payload: {
            ...payload,
            sale_listing: { ...saleListing, active: false, last_seen_at: now },
          },
          updated_at: now,
        })
        .eq("workspace_id", workspaceId)
        .eq("id", row.id);
    }),
  );
  const staleError = staleUpdates.find((result) => result.error)?.error;
  if (staleError) throw new Error(staleError.message);

  return {
    provider,
    providerLabel,
    imported: newListings.length,
    updated: fetched.listings.length - newListings.length,
    staleMarked: staleRows.length,
    excludedNonGerman: fetched.excludedNonGerman,
    totalAtSource: fetched.totalOffers,
    pagesFetched: fetched.pagesFetched,
  };
}

function toExternalId(provider: string, listing: PublicSaleListing) {
  return `${provider}:${listing.listingId}`;
}

function toProviderPayload(
  provider: string,
  providerLabel: string,
  listing: PublicSaleListing,
  retrievedAt: string,
) {
  return {
    source: provider,
    country_code: "DE",
    industry_name: listing.industry,
    employees: listing.employees,
    revenue_cents: listing.revenueCents,
    ebit_cents: listing.ebitCents,
    ebitda_cents: listing.ebitdaCents,
    sale_listing: {
      active: true,
      provider,
      provider_label: providerLabel,
      listing_id: listing.listingId,
      source_url: listing.sourceUrl,
      asking_price_cents: listing.askingPriceCents,
      location: listing.location,
      tags: listing.tags,
      retrieved_at: retrievedAt,
      last_seen_at: retrievedAt,
    },
  };
}

function asRecord(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
}
