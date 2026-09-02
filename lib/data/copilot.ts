import "server-only";

import { createAdminClient } from "@/lib/db/admin";
import type {
  CopilotAnswer,
  CopilotMode,
  CopilotRunView,
} from "@/lib/copilot/types";

type Json = Record<string, unknown>;

export type CopilotSourceInput = {
  provider: string;
  url: string;
  canonicalUrl: string;
  title: string | null;
  decision: "accepted" | "rejected";
  rejectionReason?: string;
  excerpt?: string;
  retrievedAt?: string | null;
  rawPayload?: Json;
};

export type CopilotPayloadTrace = {
  sequence: number;
  eventType: string;
  promptVersion: string | null;
  model: string;
  provider: string | null;
  inputSnapshot: Json;
  durationMs: number | null;
  createdAt: string;
};

function databaseError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

export async function createCopilotRun(input: {
  workspaceId: string;
  companyId: string;
  userId: string;
  question: string;
  mode: CopilotMode;
}) {
  const { data, error } = await createAdminClient()
    .from("copilot_research_runs")
    .insert({
      workspace_id: input.workspaceId,
      company_id: input.companyId,
      user_id: input.userId,
      user_question: input.question,
      requested_mode: input.mode,
      status: "queued",
    })
    .select("id")
    .single();
  databaseError("Unable to create Copilot research run", error);
  return data!.id as string;
}

export async function updateCopilotRun(
  workspaceId: string,
  runId: string,
  values: Record<string, unknown>,
) {
  const { error } = await createAdminClient()
    .from("copilot_research_runs")
    .update(values)
    .eq("workspace_id", workspaceId)
    .eq("id", runId);
  databaseError("Unable to update Copilot research run", error);
}

export async function appendCopilotTrace(input: {
  workspaceId: string;
  runId: string;
  sequence: number;
  eventType: string;
  promptTemplate?: string;
  promptVersion?: string;
  model?: string;
  provider?: string;
  inputSnapshot?: Json;
  outputSnapshot?: Json;
  tokenUsage?: Json;
  estimatedCostMicros?: number | null;
  durationMs?: number;
  error?: string;
}) {
  const { error } = await createAdminClient()
    .from("copilot_trace_events")
    .insert({
      workspace_id: input.workspaceId,
      research_run_id: input.runId,
      sequence: input.sequence,
      event_type: input.eventType,
      prompt_template: input.promptTemplate,
      prompt_version: input.promptVersion,
      model: input.model,
      provider: input.provider,
      input_snapshot: input.inputSnapshot ?? {},
      output_snapshot: input.outputSnapshot ?? {},
      token_usage: input.tokenUsage ?? {},
      estimated_cost_micros: input.estimatedCostMicros,
      duration_ms: input.durationMs,
      error_details: input.error ? { message: input.error } : null,
    });
  databaseError("Unable to save Copilot trace", error);
}

export async function saveCopilotQuery(input: {
  workspaceId: string;
  runId: string;
  tool: string;
  purpose: string;
  query: string;
  resultCount: number;
  acceptedCount: number | null;
  rejectedCount: number | null;
  durationMs: number;
}) {
  const { error } = await createAdminClient()
    .from("copilot_search_queries")
    .insert({
      workspace_id: input.workspaceId,
      research_run_id: input.runId,
      tool: input.tool,
      purpose: input.purpose,
      query: input.query,
      result_count: input.resultCount,
      accepted_count: input.acceptedCount,
      rejected_count: input.rejectedCount,
      duration_ms: input.durationMs,
    });
  databaseError("Unable to save Copilot query", error);
}

export async function saveCopilotSources(
  workspaceId: string,
  runId: string,
  sources: CopilotSourceInput[],
) {
  if (!sources.length) return new Map<string, string>();
  const uniqueSources = deduplicateCopilotSources(sources);
  const { data, error } = await createAdminClient()
    .from("copilot_research_sources")
    .upsert(
      uniqueSources.map((source) => ({
        workspace_id: workspaceId,
        research_run_id: runId,
        provider: source.provider,
        source_type:
          source.provider === "firecrawl" ? "first_party" : "external",
        url: source.url,
        canonical_url: source.canonicalUrl,
        title: source.title,
        decision: source.decision,
        rejection_reason: source.rejectionReason,
        relevant_excerpt: source.excerpt,
        retrieved_at: source.retrievedAt,
        raw_payload: source.rawPayload ?? {},
      })),
      { onConflict: "research_run_id,canonical_url" },
    )
    .select("id,url,canonical_url");
  databaseError("Unable to save Copilot sources", error);
  const idByCanonicalUrl = new Map(
    (data ?? []).map((row) => [row.canonical_url as string, row.id as string]),
  );
  return new Map(
    sources.flatMap((source) => {
      const id = idByCanonicalUrl.get(source.canonicalUrl);
      return id ? [[source.url, id] as const] : [];
    }),
  );
}

export function deduplicateCopilotSources(sources: CopilotSourceInput[]) {
  const byCanonicalUrl = new Map<string, CopilotSourceInput>();
  for (const source of sources) {
    const existing = byCanonicalUrl.get(source.canonicalUrl);
    if (
      !existing ||
      (existing.decision === "rejected" && source.decision === "accepted")
    )
      byCanonicalUrl.set(source.canonicalUrl, source);
  }
  return [...byCanonicalUrl.values()];
}

export async function deleteCopilotRun(workspaceId: string, runId: string) {
  const { data, error } = await createAdminClient()
    .from("copilot_research_runs")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", runId)
    .in("status", ["completed", "failed", "cancelled"])
    .select("id")
    .maybeSingle();
  databaseError("Unable to delete Copilot research run", error);
  return Boolean(data);
}

export async function saveCopilotClaims(
  workspaceId: string,
  runId: string,
  answer: CopilotAnswer,
  sourceIds: Map<string, string>,
) {
  const rows = answer.claims.flatMap((claim) =>
    claim.sourceUrls.map((url) => ({
      workspace_id: workspaceId,
      research_run_id: runId,
      source_id: sourceIds.get(url) ?? null,
      claim_type: "research_answer",
      claim_text: claim.text,
      support_status: "supported",
      confidence: claim.confidence,
    })),
  );
  if (!rows.length) return;
  const { error } = await createAdminClient()
    .from("copilot_research_claims")
    .insert(rows);
  databaseError("Unable to save Copilot claims", error);
}

export async function getCopilotRun(
  workspaceId: string,
  runId: string,
): Promise<CopilotRunView | null> {
  const supabase = createAdminClient();
  const [run, sources] = await Promise.all([
    supabase
      .from("copilot_research_runs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("id", runId)
      .maybeSingle(),
    supabase
      .from("copilot_research_sources")
      .select("id,provider,url,title,relevant_excerpt,decision")
      .eq("workspace_id", workspaceId)
      .eq("research_run_id", runId)
      .eq("decision", "accepted")
      .order("created_at", { ascending: true }),
  ]);
  databaseError("Unable to load Copilot run", run.error);
  databaseError("Unable to load Copilot sources", sources.error);
  if (!run.data) return null;
  return mapRun(run.data as Record<string, unknown>, sources.data ?? []);
}

export async function listCompanyCopilotRuns(
  workspaceId: string,
  companyId: string,
  limit = 8,
): Promise<CopilotRunView[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("copilot_research_runs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  databaseError("Unable to list Copilot runs", error);
  if (!data?.length) return [];
  const ids = data.map((row) => row.id as string);
  const { data: sourceRows, error: sourceError } = await supabase
    .from("copilot_research_sources")
    .select("id,research_run_id,provider,url,title,relevant_excerpt,decision")
    .in("research_run_id", ids)
    .eq("decision", "accepted")
    .order("created_at", { ascending: true });
  databaseError("Unable to list Copilot sources", sourceError);
  return data.map((row) =>
    mapRun(
      row as Record<string, unknown>,
      (sourceRows ?? []).filter((source) => source.research_run_id === row.id),
    ),
  );
}

export async function getEvalConsoleData(workspaceId: string) {
  const supabase = createAdminClient();
  const [runs, results, datasets, cases] = await Promise.all([
    supabase
      .from("copilot_research_runs")
      .select(
        "id,company_id,user_question,requested_mode,resolved_mode,task_types,status,model_route,estimated_cost_micros,latency_ms,created_at",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("eval_results")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("eval_datasets")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("eval_cases")
      .select("id,dataset_id,source_run_id,question,research_mode,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
  ]);
  databaseError("Unable to load Eval runs", runs.error);
  databaseError("Unable to load Eval results", results.error);
  databaseError("Unable to load Eval datasets", datasets.error);
  databaseError("Unable to load Eval cases", cases.error);
  return {
    runs: runs.data ?? [],
    results: results.data ?? [],
    datasets: datasets.data ?? [],
    cases: cases.data ?? [],
  };
}

export async function getCopilotPayloadTraces(
  workspaceId: string,
  runId: string,
): Promise<CopilotPayloadTrace[]> {
  const { data, error } = await createAdminClient()
    .from("copilot_trace_events")
    .select(
      "sequence,event_type,prompt_version,model,provider,input_snapshot,duration_ms,created_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("research_run_id", runId)
    .not("model", "is", null)
    .order("sequence", { ascending: true });
  databaseError("Unable to load Copilot payload traces", error);
  return (data ?? []).map((trace) => ({
    sequence: trace.sequence as number,
    eventType: trace.event_type as string,
    promptVersion: (trace.prompt_version as string | null) ?? null,
    model: trace.model as string,
    provider: (trace.provider as string | null) ?? null,
    inputSnapshot: (trace.input_snapshot as Json) ?? {},
    durationMs: (trace.duration_ms as number | null) ?? null,
    createdAt: trace.created_at as string,
  }));
}

export async function saveEvalResult(values: Record<string, unknown>) {
  const { error } = await createAdminClient()
    .from("eval_results")
    .insert(values);
  databaseError("Unable to save evaluation", error);
}

function mapRun(
  row: Record<string, unknown>,
  sourceRows: Array<Record<string, unknown>>,
): CopilotRunView {
  const errorDetails = row.error_details as { message?: string } | null;
  return {
    id: row.id as string,
    companyId: (row.company_id as string | null) ?? null,
    question: row.user_question as string,
    requestedMode: row.requested_mode as CopilotMode,
    resolvedMode: (row.resolved_mode as CopilotRunView["resolvedMode"]) ?? null,
    answerLength: (row.answer_length as CopilotRunView["answerLength"]) ?? null,
    taskTypes: (row.task_types as string[]) ?? [],
    status: row.status as CopilotRunView["status"],
    answer: (row.answer as string | null) ?? null,
    answerPayload: (row.answer_payload as Partial<CopilotAnswer>) ?? {},
    modelRoute: (row.model_route as Json) ?? {},
    tokenUsage: (row.token_usage as Json) ?? {},
    estimatedCostMicros: (row.estimated_cost_micros as number | null) ?? null,
    latencyMs: (row.latency_ms as number | null) ?? null,
    error: errorDetails?.message ?? null,
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
    sources: sourceRows.map((source) => ({
      id: source.id as string,
      provider: source.provider as string,
      url: source.url as string,
      title: (source.title as string | null) ?? null,
      excerpt: (source.relevant_excerpt as string | null) ?? null,
    })),
  };
}
