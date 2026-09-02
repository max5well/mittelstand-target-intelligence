import "server-only";

import { createAdminClient } from "@/lib/db/admin";
import {
  fetchGermanConcessListings,
  type ConcessListing,
} from "@/lib/integrations/concess";

type Row = Record<string, unknown>;
const PROVIDER = "concess";

export async function importGermanConcessListings(workspaceId: string) {
  if (!isConcessImportEnabled())
    throw new Error(
      "con|cess import is disabled until the source has authorized automated reuse",
    );
  const fetched = await fetchGermanConcessListings();
  const supabase = createAdminClient();
  const externalIds = fetched.listings.map(toExternalId);
  const { data: existingRows, error: existingError } = await supabase
    .from("companies")
    .select("id,openregister_company_id,raw_provider_payload")
    .eq("workspace_id", workspaceId)
    .like("openregister_company_id", `${PROVIDER}:%`);
  if (existingError) throw new Error(existingError.message);

  const existingByExternalId = new Map(
    (existingRows ?? []).map((row) => [row.openregister_company_id, row]),
  );
  const now = new Date().toISOString();
  const companyRows = fetched.listings.map((listing) => ({
    workspace_id: workspaceId,
    openregister_company_id: toExternalId(listing),
    legal_name: listing.title,
    legal_form: null,
    purpose: listing.description || null,
    raw_provider_payload: toProviderPayload(listing, now),
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
          .eq("source_provider", PROVIDER)
          .in("company_id", currentCompanyIds),
        supabase
          .from("company_sources")
          .select("company_id,source_identifier")
          .eq("workspace_id", workspaceId)
          .eq("provider", PROVIDER)
          .in("company_id", currentCompanyIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (locationsReadError) throw new Error(locationsReadError.message);
  if (sourcesReadError) throw new Error(sourcesReadError.message);

  const newListings = fetched.listings.filter(
    (listing) => !existingByExternalId.has(toExternalId(listing)),
  );
  const locationCompanyIds = new Set(
    (currentLocations ?? []).map((row) => row.company_id),
  );
  const sourceCompanyIds = new Set(
    (currentSources ?? []).map((row) => row.company_id),
  );
  const locationRows = fetched.listings.flatMap((listing) => {
    const companyId = companyByExternalId.get(toExternalId(listing));
    if (!companyId || locationCompanyIds.has(companyId)) return [];
    return [
      {
        workspace_id: workspaceId,
        company_id: companyId,
        city: listing.location ?? "Deutschland",
        bundesland: null,
        country_code: "DE",
        is_registered: false,
        source_provider: PROVIDER,
        source_identifier: listing.listingId,
        retrieved_at: now,
      },
    ];
  });
  const sourceRows = fetched.listings.flatMap((listing) => {
    const companyId = companyByExternalId.get(toExternalId(listing));
    if (!companyId || sourceCompanyIds.has(companyId)) return [];
    return [
      {
        workspace_id: workspaceId,
        company_id: companyId,
        provider: PROVIDER,
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
    imported: newListings.length,
    updated: fetched.listings.length - newListings.length,
    staleMarked: staleRows.length,
    excludedNonGerman: fetched.excludedNonGerman,
    totalAtSource: fetched.totalOffers,
    pagesFetched: fetched.pagesFetched,
  };
}

export function isConcessImportEnabled() {
  return process.env.CONCESS_IMPORT_ENABLED === "true";
}

function toExternalId(listing: ConcessListing) {
  return `${PROVIDER}:${listing.listingId}`;
}

function toProviderPayload(listing: ConcessListing, retrievedAt: string) {
  return {
    source: PROVIDER,
    country_code: "DE",
    industry_name: listing.industry,
    employees: listing.employees,
    revenue_cents: listing.revenueCents,
    ebit_cents: listing.ebitCents,
    ebitda_cents: listing.ebitdaCents,
    sale_listing: {
      active: true,
      provider: PROVIDER,
      provider_label: "con|cess M+A-Partner",
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
