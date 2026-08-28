import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/db/admin";

type Address = {
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
  importance?: number;
  address?: Record<string, string>;
};

let geocodeTail: Promise<void> = Promise.resolve();

function enqueueGeocode<T>(task: () => Promise<T>): Promise<T> {
  const run = geocodeTail.then(task);
  geocodeTail = run.then(
    () => new Promise((resolve) => setTimeout(resolve, 1_100)),
    () => new Promise((resolve) => setTimeout(resolve, 1_100)),
  );
  return run;
}

export async function geocodeRegisteredAddress(input: {
  workspaceId: string;
  companyId: string;
  address: Address;
}) {
  const formatted = [
    input.address.street,
    [input.address.postalCode, input.address.city].filter(Boolean).join(" "),
    input.address.country ?? "DE",
  ]
    .filter(Boolean)
    .join(", ");
  if (!formatted) return { status: "failed" as const };

  const addressHash = createHash("sha256").update(formatted).digest("hex");
  const supabase = createAdminClient();
  const { data: cached } = await supabase
    .from("geocoding_results")
    .select("status,latitude,longitude,match_quality")
    .eq("company_id", input.companyId)
    .eq("address_hash", addressHash)
    .maybeSingle();
  if (cached) return cached;

  const baseUrl = process.env.GEOCODER_BASE_URL ?? "https://nominatim.openstreetmap.org";
  const geocodeResponse = await enqueueGeocode(async () => {
    const url = new URL("/search", baseUrl);
    url.searchParams.set("q", formatted);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", "de");
    url.searchParams.set("limit", "3");
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent":
          process.env.GEOCODER_USER_AGENT ??
          "UnternehmenTargetIntelligence/1.0 (https://unternehmen-target-intelligence.maximilian27274.chatgpt.site)",
      },
    });
    if (!response.ok)
      return { results: [] as NominatimResult[], httpStatus: response.status };
    return {
      results: (await response.json()) as NominatimResult[],
      httpStatus: response.status,
    };
  });
  const results = geocodeResponse.results;

  const best = results[0];
  const exactPostcode =
    Boolean(input.address.postalCode) &&
    best?.address?.postcode === input.address.postalCode;
  const matchQuality = best
    ? exactPostcode
      ? "postcode"
      : "address"
    : "no_match";
  const status = best
    ? exactPostcode || results.length === 1
      ? "matched"
      : "ambiguous"
    : "failed";
  const row = {
    workspace_id: input.workspaceId,
    company_id: input.companyId,
    address_hash: addressHash,
    provider: "openstreetmap_nominatim",
    latitude: best ? Number(best.lat) : null,
    longitude: best ? Number(best.lon) : null,
    match_quality: matchQuality,
    status,
    retrieved_at: new Date().toISOString(),
    raw_payload: best ?? { query: formatted, results: 0 },
  };
  const { error } = await supabase.from("geocoding_results").upsert(row, {
    onConflict: "company_id,address_hash",
  });
  if (error) throw new Error(`Unable to persist geocoding result: ${error.message}`);
  const { data: job, error: jobError } = await supabase
    .from("enrichment_jobs")
    .upsert(
      {
        workspace_id: input.workspaceId,
        company_id: input.companyId,
        provider: "openstreetmap_nominatim",
        job_type: "geocoding",
        status: "succeeded",
        idempotency_key: `${input.companyId}:geocode:${addressHash}`,
        payload: { address: formatted, available: Boolean(best), matchQuality },
        attempt_count: 1,
        estimated_credits: 0,
        actual_credits: 0,
        started_at: row.retrieved_at,
        completed_at: row.retrieved_at,
      },
      { onConflict: "workspace_id,idempotency_key" },
    )
    .select("id")
    .single();
  if (jobError || !job)
    throw new Error(jobError?.message ?? "Unable to record geocoding job");
  const { error: usageError } = await supabase.from("provider_usage_events").insert({
    workspace_id: input.workspaceId,
    provider: "openstreetmap_nominatim",
    endpoint: "GET /search",
    enrichment_job_id: job.id,
    estimated_credits: 0,
    actual_credits: 0,
    request_count: 1,
    http_status: geocodeResponse.httpStatus,
  });
  if (usageError) throw new Error(`Unable to record geocoding usage: ${usageError.message}`);
  return row;
}
