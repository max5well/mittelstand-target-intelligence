import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/db/admin";
import { matchesAcquisitionLegalForm } from "@/lib/acquisition-target-preset";
import {
  runOpenRegisterEnrichment,
  type OpenRegisterStage,
} from "@/lib/enrichment/openregister";
import { runExternalProviderEnrichment } from "@/lib/enrichment/external-providers";
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

export function shouldAutoDiscoverWebsites(search: SavedSearchRow) {
  return (
    search.hydration_stages?.includes("website_discovery") ||
    search.hydration_mode === "lean" ||
    search.hydration_mode === "full"
  );
}

export async function runSavedSearch(search: SavedSearchRow) {
  const supabase = createAdminClient();
  const filters = CompanySearchRequestSchema.shape.filters.parse(
    search.filters,
  );
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
  if (runError || !run)
    throw new Error(runError?.message ?? "Unable to start search run");

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
    throw new Error(
      searchJobError?.message ?? "Unable to record discovery job",
    );

  try {
    const legalFormFilter = filters.find(
      (filter) => filter.field === "legal_form",
    );
    const selectedLegalForms =
      legalFormFilter?.values?.map(String) ??
      (legalFormFilter?.value == null ? [] : [String(legalFormFilter.value)]);
    const needsKgNameVerification = selectedLegalForms.includes("kg");
    const requestedResults = needsKgNameVerification
      ? Math.min(100, Math.max(target, target * 3))
      : target;
    const response = await new OpenRegisterProvider().search({
      filters,
      pagination: { page: 1, per_page: requestedResults },
    });
    const providerResults = response.results;
    const results = (
      selectedLegalForms.length
        ? providerResults.filter((company) =>
            matchesAcquisitionLegalForm(company, selectedLegalForms),
          )
        : providerResults
    ).slice(0, target);
    const externalIds = results.map((company) => company.company_id);
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

    const rows = results.map((company) => ({
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
    const runResults = results.flatMap((company, index) => {
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
      const { error } = await supabase
        .from("search_run_results")
        .insert(runResults);
      if (error) throw new Error(error.message);
    }

    const acceptedCount = results.filter(
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
    const enrichmentErrors: Array<{
      companyId: string;
      stage: string;
      message: string;
    }> = [];
    for (const company of results) {
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
            message:
              error instanceof Error
                ? error.message
                : "Unknown enrichment error",
          });
        }
      }
    }
    let websiteDiscoveryCalls = 0;
    let websitesAdded = 0;
    let websitesUnavailable = 0;
    let websiteCreditsUsed = 0;
    const websiteDiscoveryErrors: Array<{
      companyId: string;
      message: string;
    }> = [];
    if (shouldAutoDiscoverWebsites(search)) {
      for (const company of results) {
        if (existingIds.has(company.company_id)) continue;
        const companyId = companyByExternalId.get(company.company_id);
        if (!companyId) continue;
        try {
          const outcome = await runExternalProviderEnrichment({
            workspaceId: search.workspace_id,
            companyId,
            stage: "website_discovery",
            searchRunId: run.id,
          });
          if (!outcome.skipped) websiteDiscoveryCalls += 1;
          if (outcome.available) websitesAdded += 1;
          else websitesUnavailable += 1;
          websiteCreditsUsed += Number(outcome.job?.actual_credits ?? 0);
        } catch (error) {
          websiteDiscoveryErrors.push({
            companyId: company.company_id,
            message:
              error instanceof Error
                ? error.message
                : "Unknown website discovery error",
          });
        }
      }
    }
    const completedAt = new Date();
    const creditsUsed =
      10 + enrichmentCalls * 10 + Math.max(0, websiteCreditsUsed);
    await Promise.all([
      supabase
        .from("search_runs")
        .update({
          status: "succeeded",
          response_metadata: {
            ...response.pagination,
            provider_results_received: providerResults.length,
            post_filter_results: results.length,
            kg_name_verification: needsKgNameVerification,
            website_discovery: {
              attempted: websiteDiscoveryCalls,
              added: websitesAdded,
              unavailable: websitesUnavailable,
            },
          },
          pages_scanned: 1,
          candidates_seen: providerResults.length,
          accepted_count: acceptedCount,
          credits_used: creditsUsed,
          error_details:
            enrichmentErrors.length || websiteDiscoveryErrors.length
              ? { enrichmentErrors, websiteDiscoveryErrors }
              : null,
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
            candidates: providerResults.length,
            qualifyingAfterPostFilter: results.length,
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
      candidates: providerResults.length,
      qualifying: results.length,
      accepted: acceptedCount,
      duplicates: results.length - acceptedCount,
      enrichmentCalls,
      unavailable,
      enrichmentErrors: enrichmentErrors.length,
      websiteDiscoveryCalls,
      websitesAdded,
      websitesUnavailable,
      websiteDiscoveryErrors: websiteDiscoveryErrors.length,
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
            message:
              error instanceof Error ? error.message : "Unknown provider error",
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
            message:
              error instanceof Error ? error.message : "Unknown provider error",
          },
        })
        .eq("id", searchJob.id),
    ]);
    throw error;
  }
}
