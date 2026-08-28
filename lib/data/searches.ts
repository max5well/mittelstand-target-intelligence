import "server-only";

import { createAdminClient } from "@/lib/db/admin";

export type StoredSearch = {
  id: string;
  name: string;
  summary: string;
  active: boolean;
  hydrationMode: string;
  updatedAt: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastAccepted: number | null;
};

export async function listSavedSearches(workspaceId: string): Promise<StoredSearch[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVER_ACCESS_TOKEN)) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("saved_searches").select("id,name,plain_language_summary,active,hydration_mode,updated_at").eq("workspace_id", workspaceId).order("updated_at", { ascending: false });
  if (error) throw new Error(`Unable to load saved searches: ${error.message}`);
  const searchIds = (data ?? []).map((row) => row.id);
  const { data: runs, error: runsError } = searchIds.length
    ? await supabase
        .from("search_runs")
        .select("saved_search_id,status,accepted_count,completed_at,started_at")
        .in("saved_search_id", searchIds)
        .order("started_at", { ascending: false })
    : { data: [], error: null };
  if (runsError) throw new Error(`Unable to load search history: ${runsError.message}`);
  const latestRun = new Map<string, (typeof runs)[number]>();
  for (const run of runs ?? []) {
    if (!latestRun.has(run.saved_search_id)) latestRun.set(run.saved_search_id, run);
  }
  return (data ?? []).map((row) => {
    const run = latestRun.get(row.id);
    return {
      id: row.id,
      name: row.name,
      summary: row.plain_language_summary,
      active: row.active,
      hydrationMode: row.hydration_mode,
      updatedAt: row.updated_at,
      lastRunAt: run?.completed_at ?? run?.started_at ?? null,
      lastRunStatus: run?.status ?? null,
      lastAccepted: run?.accepted_count ?? null,
    };
  });
}
