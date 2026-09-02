import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/db/admin";
import { geocodeRegisteredAddress } from "@/lib/geocoding/nominatim";
import { OpenRegisterProvider } from "@/lib/integrations/openregister";
import {
  creditsForProviderOutcome,
  ProviderError,
  type ProviderRequestMetrics,
} from "@/lib/integrations/http";

export const openRegisterStages = ["details", "financials", "owners"] as const;
export type OpenRegisterStage = (typeof openRegisterStages)[number];
type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
const asRecords = (value: unknown): JsonRecord[] =>
  Array.isArray(value) ? value.map(asRecord) : [];
const asText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;
const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function stageCost(stage: OpenRegisterStage) {
  return stage === "details" || stage === "financials" || stage === "owners"
    ? 10
    : 0;
}

export async function runOpenRegisterEnrichment(input: {
  workspaceId: string;
  companyId: string;
  stage: OpenRegisterStage;
  searchRunId?: string | null;
  force?: boolean;
}) {
  const supabase = createAdminClient();
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id,openregister_company_id,raw_provider_payload")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.companyId)
    .single();
  if (companyError || !company)
    throw new Error(companyError?.message ?? "Company not found");
  if (!company.openregister_company_id)
    throw new Error("This target has no OpenRegister company ID");

  if (!input.force) {
    const { data: previous } = await supabase
      .from("enrichment_jobs")
      .select("id,status,actual_credits,completed_at,payload")
      .eq("workspace_id", input.workspaceId)
      .eq("company_id", input.companyId)
      .eq("provider", "openregister")
      .eq("job_type", input.stage)
      .eq("status", "succeeded")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previous)
      return {
        job: previous,
        skipped: true,
        available: asRecord(previous.payload).available !== false,
      };
  }

  const startedAt = new Date();
  const leaseExpiresAt = new Date(startedAt.getTime() + 55_000);
  const cost = stageCost(input.stage);
  const { data: job, error: jobError } = await supabase
    .from("enrichment_jobs")
    .insert({
      workspace_id: input.workspaceId,
      company_id: input.companyId,
      search_run_id: input.searchRunId ?? null,
      provider: "openregister",
      job_type: input.stage,
      status: "running",
      idempotency_key: `${input.companyId}:${input.stage}:${randomUUID()}`,
      payload: { companyId: company.openregister_company_id },
      attempt_count: 1,
      estimated_credits: cost,
      started_at: startedAt.toISOString(),
      heartbeat_at: startedAt.toISOString(),
      lease_expires_at: leaseExpiresAt.toISOString(),
    })
    .select("id")
    .single();
  if (jobError?.code === "23505") {
    const { data: active } = await supabase
      .from("enrichment_jobs")
      .select("id,status,actual_credits,completed_at,payload")
      .eq("workspace_id", input.workspaceId)
      .eq("company_id", input.companyId)
      .eq("provider", "openregister")
      .eq("job_type", input.stage)
      .eq("status", "running")
      .maybeSingle();
    if (active)
      return { job: active, skipped: true, available: false, running: true };
  }
  if (jobError || !job)
    throw new Error(jobError?.message ?? "Unable to create enrichment job");

  let httpStatus = 200;
  const metrics: ProviderRequestMetrics = { requestCount: 0 };
  try {
    const provider = new OpenRegisterProvider();
    let payload: JsonRecord;
    try {
      payload =
        input.stage === "details"
          ? await provider.company(company.openregister_company_id, metrics)
          : input.stage === "financials"
            ? await provider.financials(
                company.openregister_company_id,
                metrics,
              )
            : await provider.owners(company.openregister_company_id, metrics);
    } catch (error) {
      if (
        error instanceof ProviderError &&
        error.status === 404 &&
        input.stage === "financials"
      ) {
        httpStatus = 404;
        payload = { available: false, reason: "not_reported_by_provider" };
      } else {
        throw error;
      }
    }

    const available = payload.available !== false;
    if (input.stage === "details" && available)
      await persistDetails(input.workspaceId, input.companyId, payload);
    if (input.stage === "financials" && available)
      await persistFinancials(input.workspaceId, input.companyId, payload);
    if (input.stage === "owners" && available)
      await persistOwners(
        input.workspaceId,
        input.companyId,
        payload,
        asRecord(company.raw_provider_payload),
      );

    const completedAt = new Date();
    const actualCredits =
      process.env.MOCK_PROVIDERS === "false"
        ? cost * Math.max(1, metrics.requestCount)
        : 0;
    const [jobResult] = await Promise.all([
      supabase
        .from("enrichment_jobs")
        .update({
          status: "succeeded",
          actual_credits: actualCredits,
          completed_at: completedAt.toISOString(),
          lease_expires_at: null,
          payload: {
            companyId: company.openregister_company_id,
            available,
            httpStatus,
          },
        })
        .eq("id", job.id)
        .select("id,status,actual_credits,completed_at,payload")
        .single(),
      supabase.from("provider_usage_events").insert({
        workspace_id: input.workspaceId,
        provider: "openregister",
        endpoint: endpointFor(input.stage),
        enrichment_job_id: job.id,
        estimated_credits: cost,
        actual_credits: actualCredits,
        request_count: Math.max(1, metrics.requestCount),
        http_status: httpStatus,
        duration_ms: completedAt.getTime() - startedAt.getTime(),
      }),
    ]);
    if (jobResult.error) throw new Error(jobResult.error.message);
    return { job: jobResult.data, skipped: false, available };
  } catch (error) {
    const completedAt = new Date();
    const requestCount =
      error instanceof ProviderError
        ? error.requestCount
        : Math.max(1, metrics.requestCount);
    const actualCredits =
      process.env.MOCK_PROVIDERS === "false"
        ? creditsForProviderOutcome(cost, error, requestCount)
        : 0;
    await Promise.all([
      supabase
        .from("enrichment_jobs")
        .update({
          status: "failed",
          actual_credits: actualCredits,
          completed_at: completedAt.toISOString(),
          lease_expires_at: null,
          error_details: {
            message:
              error instanceof Error
                ? error.message
                : "Unknown OpenRegister error",
          },
        })
        .eq("id", job.id),
      supabase.from("provider_usage_events").insert({
        workspace_id: input.workspaceId,
        provider: "openregister",
        endpoint: endpointFor(input.stage),
        enrichment_job_id: job.id,
        estimated_credits: cost,
        actual_credits: actualCredits,
        request_count: requestCount,
        http_status: error instanceof ProviderError ? error.status : null,
        duration_ms: completedAt.getTime() - startedAt.getTime(),
      }),
    ]);
    throw error;
  }
}

function endpointFor(stage: OpenRegisterStage) {
  return stage === "details"
    ? "GET /v1/company/:id"
    : stage === "financials"
      ? "GET /v1/company/:id/financials"
      : "GET /v1/company/:id/owners";
}

async function persistDetails(
  workspaceId: string,
  companyId: string,
  payload: JsonRecord,
) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const name = asRecord(payload.name);
  const register = asRecord(payload.register);
  const address = asRecord(payload.address);
  const contact = asRecord(payload.contact);
  const purpose = asRecord(payload.purpose);
  const legalName = asText(name.name) ?? asText(payload.name);
  const website =
    asText(contact.website_url) ??
    asText(contact.website) ??
    asText(contact.url);
  const companyUpdate = {
    ...(legalName ? { legal_name: legalName } : {}),
    ...(asText(payload.legal_form)
      ? { legal_form: asText(payload.legal_form) }
      : {}),
    ...(asText(register.register_number)
      ? { register_number: asText(register.register_number) }
      : {}),
    ...(website ? { website_url: website } : {}),
    ...((asText(purpose.purpose) ?? asText(payload.purpose))
      ? { purpose: asText(purpose.purpose) ?? asText(payload.purpose) }
      : {}),
    ...(asText(payload.incorporated_at)
      ? { incorporation_date: asText(payload.incorporated_at) }
      : {}),
    hydration_stage: "profiled",
    raw_provider_payload: payload,
    updated_at: now,
  };
  const { error: updateError } = await supabase
    .from("companies")
    .update(companyUpdate)
    .eq("id", companyId)
    .eq("workspace_id", workspaceId);
  if (updateError) throw new Error(updateError.message);

  assertSupabaseResults(
    await Promise.all([
      supabase
        .from("company_locations")
        .delete()
        .eq("company_id", companyId)
        .eq("source_provider", "openregister"),
      supabase
        .from("company_management")
        .delete()
        .eq("company_id", companyId)
        .eq("source_provider", "openregister"),
      supabase
        .from("company_names")
        .delete()
        .eq("company_id", companyId)
        .eq("source_provider", "openregister"),
    ]),
  );
  const insertions: Array<PromiseLike<unknown>> = [];
  if (legalName)
    insertions.push(
      supabase.from("company_names").insert({
        workspace_id: workspaceId,
        company_id: companyId,
        name: legalName,
        name_type: "legal",
        valid_from: asText(name.start_date),
        source_provider: "openregister",
        source_identifier: asText(payload.id),
        retrieved_at: now,
      }),
    );
  if (Object.keys(address).length)
    insertions.push(
      supabase.from("company_locations").insert({
        workspace_id: workspaceId,
        company_id: companyId,
        address_line: asText(address.street) ?? asText(address.formatted_value),
        postcode: asText(address.postal_code),
        city: asText(address.city),
        country_code: asText(address.country) ?? "DE",
        source_provider: "openregister",
        source_identifier: asText(payload.id),
        retrieved_at: now,
      }),
    );
  const management = asRecords(payload.representation).flatMap((person) => {
    const fullName = asText(person.name);
    if (!fullName) return [];
    return [
      {
        workspace_id: workspaceId,
        company_id: companyId,
        full_name: fullName,
        role: asText(person.role) ?? "Representative",
        started_on: asText(person.start_date),
        ended_on: asText(person.end_date),
        source_provider: "openregister",
        source_identifier: asText(person.id),
        retrieved_at: now,
        raw_payload: person,
      },
    ];
  });
  if (management.length)
    insertions.push(supabase.from("company_management").insert(management));
  const source = asRecords(payload.sources)[0] ?? {};
  insertions.push(
    supabase.from("company_sources").insert({
      workspace_id: workspaceId,
      company_id: companyId,
      provider: "openregister",
      source_identifier: `${asText(payload.id) ?? companyId}:details`,
      source_url: asText(source.document_url),
      source_date: asText(name.start_date) ?? asText(payload.incorporated_at),
      retrieved_at: now,
      raw_payload: payload,
    }),
  );
  assertSupabaseResults(await Promise.all(insertions));

  if (Object.keys(address).length)
    await geocodeRegisteredAddress({
      workspaceId,
      companyId,
      address: {
        street: asText(address.street) ?? asText(address.formatted_value),
        postalCode: asText(address.postal_code),
        city: asText(address.city),
        country: asText(address.country),
      },
    });
}

async function persistFinancials(
  workspaceId: string,
  companyId: string,
  payload: JsonRecord,
) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const rows = asRecords(payload.indicators).flatMap((indicator) => {
    const date = asText(indicator.date);
    if (!date) return [];
    return [
      {
        workspace_id: workspaceId,
        company_id: companyId,
        fiscal_period_end: date,
        consolidated: Boolean(indicator.consolidated),
        currency: "EUR",
        revenue_cents: asNumber(indicator.revenue),
        ebitda_cents: asNumber(indicator.ebitda),
        ebit_cents: asNumber(indicator.ebit),
        net_income_cents: asNumber(indicator.net_income),
        equity_cents: asNumber(indicator.equity),
        cash_cents: asNumber(indicator.cash),
        debt_cents: asNumber(indicator.financial_debt),
        total_assets_cents: asNumber(indicator.balance_sheet_total),
        employees: asNumber(indicator.employees),
        source_provider: "openregister",
        source_identifier: asText(indicator.report_id),
        retrieved_at: now,
        raw_payload: indicator,
      },
    ];
  });
  if (rows.length) {
    const { error } = await supabase
      .from("company_financial_periods")
      .upsert(rows, {
        onConflict: "company_id,fiscal_period_end,consolidated,source_provider",
      });
    if (error) throw new Error(error.message);
    const { error: companyError } = await supabase
      .from("companies")
      .update({ hydration_stage: "financials_complete", updated_at: now })
      .eq("id", companyId)
      .eq("workspace_id", workspaceId);
    if (companyError) throw new Error(companyError.message);
  }
}

async function persistOwners(
  workspaceId: string,
  companyId: string,
  payload: JsonRecord,
  companyPayload: JsonRecord,
) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const owners = asRecords(payload.owners);
  const { error: deleteError } = await supabase
    .from("company_owners")
    .delete()
    .eq("company_id", companyId)
    .eq("source_provider", "openregister");
  if (deleteError) throw new Error(deleteError.message);
  const rows = owners.flatMap((owner) => {
    const ownerName = asText(owner.name);
    if (!ownerName) return [];
    return [
      {
        workspace_id: workspaceId,
        company_id: companyId,
        owner_name: ownerName,
        owner_type: asText(owner.type),
        ownership_percent: asNumber(owner.percentage_share),
        // OpenRegister documents this as a share/capital amount, not EUR.
        // Preserve the source value in raw_payload until the unit is explicit.
        nominal_share_cents: null,
        best_available: Boolean(payload.best_available),
        source_provider: "openregister",
        source_identifier: asText(owner.id),
        retrieved_at: now,
        raw_payload: owner,
      },
    ];
  });
  if (rows.length) {
    const { error } = await supabase.from("company_owners").insert(rows);
    if (error) throw new Error(error.message);
  }

  const managers = new Set(
    asRecords(companyPayload.representation)
      .map((person) => asText(person.name)?.toLocaleLowerCase("de"))
      .filter(Boolean),
  );
  const ownerManaged = owners.some((owner) => {
    const ownerName = asText(owner.name)?.toLocaleLowerCase("de");
    return ownerName ? managers.has(ownerName) : false;
  });
  const soleNaturalOwner =
    owners.length === 1 && asText(owners[0]?.type) === "natural_person";
  const classification = ownerManaged
    ? "Owner-managed"
    : soleNaturalOwner
      ? "Founder/individual-owned"
      : "Unknown";
  const { error: previousClassificationError } = await supabase
    .from("company_ownership_classifications")
    .update({ is_current: false })
    .eq("company_id", companyId)
    .eq("is_current", true);
  if (previousClassificationError)
    throw new Error(previousClassificationError.message);
  const { error: classificationError } = await supabase
    .from("company_ownership_classifications")
    .insert({
      workspace_id: workspaceId,
      company_id: companyId,
      classification,
      classification_method: "rules",
      confidence: ownerManaged ? 0.98 : soleNaturalOwner ? 0.9 : 0.3,
      evidence: owners.map((owner) => ({
        owner: asText(owner.name),
        type: asText(owner.type),
        percentage: asNumber(owner.percentage_share),
        managementMatch: ownerManaged,
      })),
      is_current: true,
    });
  if (classificationError) throw new Error(classificationError.message);
  const { error: companyError } = await supabase
    .from("companies")
    .update({ hydration_stage: "ownership_complete", updated_at: now })
    .eq("id", companyId)
    .eq("workspace_id", workspaceId);
  if (companyError) throw new Error(companyError.message);
}

function assertSupabaseResults(results: unknown[]) {
  for (const result of results) {
    const error = asRecord(asRecord(result).error);
    if (Object.keys(error).length)
      throw new Error(
        asText(error.message) ?? "Unable to persist OpenRegister data",
      );
  }
}
