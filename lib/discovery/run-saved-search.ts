import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/db/admin";
import {
  runOpenRegisterEnrichment,
  type OpenRegisterStage,
} from "@/lib/enrichment/openregister";
import {
  CompanySearchRequestSchema,
  OpenRegisterProvider,
} from "@/lib/integrations/openregister";

type SavedSearchRow = {
  id: string;
  workspace_id: string;
  filters: unknown;
  daily_target: number;
  hydration_mode?: "lean" | "full" | "custom";
  hydration_stages?: string[];
};

export async function runSavedSearch(search: SavedSearchRow) {
  const supabase = createAdminClient();
  const filters = CompanySearchRequestSchema.shape.filters.parse(search.filters);
  const target = Math.max(1, Math.min(100, search.daily_target));
  const now = new Date();
  const runKey = `manual:${now.toISOString()}:${randomUUID()}`;

  const { data: run, error: runError } = await supabase
    .from("search_runs")
    .insert({
      workspace_id: search.workspace_id,
      saved_search_id: search.id,
      run_key: runKey,
      scheduled_date: now.toISOString().slice(0, 10),
      status: "running",
      exact_filters: filters,
      started_at: now.toISOString(),
      credits_estimated: 10,
    })
    .select("id")
    .single();
  if (runError || !run) throw new Error(runError?.message ?? "Unable to start search run");

  const { data: searchJob, error: searchJobError } = await supabase
    .from("enrichment_jobs")
    .insert({
      workspace_id: search.workspace_id,
      search_run_id: run.id,
      provider: "openregister",
      job_type: "search",
      status: "running",
      idempotency_key: `${runKey}:search`,
      payload: { filters, target },
      attempt_count: 1,
      estimated_credits: 10,
      started_at: now.toISOString(),
    })
    .select("id")
    .single();
  if (searchJobError || !searchJob)
    throw new Error(searchJobError?.message ?? "Unable to record discovery job");

  try {
    const response = await new OpenRegisterProvider().search({
      filters,
      pagination: { page: 1, per_page: target },
    });
    const externalIds = response.results.map((company) => company.company_id);
    const { data: existing } = externalIds.length
      ? await supabase
          .from("companies")
          .select("id,openregister_company_id")
          .eq("workspace_id", search.workspace_id)
          .in("openregister_company_id", externalIds)
      : { data: [] };
    const existingIds = new Set(
      (existing ?? []).map((company) => company.openregister_company_id),
    );

    const rows = response.results.map((company) => ({
      workspace_id: search.workspace_id,
      openregister_company_id: company.company_id,
      legal_name: company.name,
      legal_form: company.legal_form ?? null,
      register_number: company.register_number ?? null,
      hydration_stage: "discovered",
      raw_provider_payload: company,
      updated_at: new Date().toISOString(),
    }));
    const { data: persisted, error: companyError } = rows.length
      ? await supabase
          .from("companies")
          .upsert(rows, {
            onConflict: "workspace_id,openregister_company_id",
          })
          .select("id,openregister_company_id")
      : { data: [], error: null };
    if (companyError) throw new Error(companyError.message);

    const companyByExternalId = new Map(
      (persisted ?? []).map((company) => [
        company.openregister_company_id,
        company.id,
      ]),
    );
    const runResults = response.results.flatMap((company, index) => {
      const companyId = companyByExternalId.get(company.company_id);
      if (!companyId) return [];
      const duplicate = existingIds.has(company.company_id);
      return [
        {
          workspace_id: search.workspace_id,
          search_run_id: run.id,
          company_id: companyId,
          result_rank: index + 1,
          accepted: !duplicate,
          duplicate_reason: duplicate ? "already_in_workspace" : null,
          raw_result: company,
        },
      ];
    });
    if (runResults.length) {
      const { error } = await supabase.from("search_run_results").insert(runResults);
      if (error) throw new Error(error.message);
    }

    const acceptedCount = response.results.filter(
      (company) => !existingIds.has(company.company_id),
    ).length;
    const requestedStages = (
      search.hydration_stages?.length
        ? search.hydration_stages
        : search.hydration_mode === "full"
          ? ["details", "financials", "owners"]
          : ["details"]
    ).filter((stage): stage is OpenRegisterStage =>
      ["details", "financials", "owners"].includes(stage),
    );
    let enrichmentCalls = 0;
    let unavailable = 0;
    const enrichmentErrors: Array<{ companyId: string; stage: string; message: string }> = [];
    for (const company of response.results) {
      const companyId = companyByExternalId.get(company.company_id);
      if (!companyId) continue;
      for (const stage of requestedStages) {
        try {
          const outcome = await runOpenRegisterEnrichment({
            workspaceId: search.workspace_id,
            companyId,
            stage,
            searchRunId: run.id,
          });
          if (!outcome.skipped) enrichmentCalls += 1;
          if (!outcome.available) unavailable += 1;
        } catch (error) {
          enrichmentErrors.push({
            companyId: company.company_id,
            stage,
            message: error instanceof Error ? error.message : "Unknown enrichment error",
          });
        }
      }
    }
    const completedAt = new Date();
    const creditsUsed = 10 + enrichmentCalls * 10;
    await Promise.all([
      supabase
        .from("search_runs")
        .update({
          status: "succeeded",
          response_metadata: response.pagination,
          pages_scanned: 1,
          candidates_seen: response.results.length,
          accepted_count: acceptedCount,
          credits_used: creditsUsed,
          error_details: enrichmentErrors.length ? { enrichmentErrors } : null,
          completed_at: completedAt.toISOString(),
        })
        .eq("id", run.id),
      supabase
        .from("enrichment_jobs")
        .update({
          status: "succeeded",
          actual_credits: 10,
          completed_at: completedAt.toISOString(),
          payload: {
            filters,
            target,
            candidates: response.results.length,
            accepted: acceptedCount,
          },
        })
        .eq("id", searchJob.id),
      supabase.from("provider_usage_events").insert({
        workspace_id: search.workspace_id,
        provider: "openregister",
        endpoint: "POST /v1/search/company",
        enrichment_job_id: searchJob.id,
        estimated_credits: 10,
        actual_credits: 10,
        request_count: 1,
        http_status: 200,
        duration_ms: completedAt.getTime() - now.getTime(),
      }),
    ]);
    return {
      runId: run.id,
      candidates: response.results.length,
      accepted: acceptedCount,
      duplicates: response.results.length - acceptedCount,
      enrichmentCalls,
      unavailable,
      enrichmentErrors: enrichmentErrors.length,
      creditsUsed,
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    await Promise.all([
      supabase
        .from("search_runs")
        .update({
          status: "failed",
          error_details: {
            message: error instanceof Error ? error.message : "Unknown provider error",
          },
          completed_at: completedAt,
        })
        .eq("id", run.id),
      supabase
        .from("enrichment_jobs")
        .update({
          status: "failed",
          actual_credits: 10,
          completed_at: completedAt,
          error_details: {
            message: error instanceof Error ? error.message : "Unknown provider error",
          },
        })
        .eq("id", searchJob.id),
    ]);
    throw error;
  }
}
