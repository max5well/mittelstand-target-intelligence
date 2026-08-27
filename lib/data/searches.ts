import "server-only";

import { createAdminClient } from "@/lib/db/admin";

export type StoredSearch = {
  id: string;
  name: string;
  summary: string;
  active: boolean;
  hydrationMode: string;
  updatedAt: string;
};

export async function listSavedSearches(workspaceId: string): Promise<StoredSearch[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return [];
  const { data, error } = await createAdminClient().from("saved_searches").select("id,name,plain_language_summary,active,hydration_mode,updated_at").eq("workspace_id", workspaceId).order("updated_at", { ascending: false });
  if (error) throw new Error(`Unable to load saved searches: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, summary: row.plain_language_summary, active: row.active, hydrationMode: row.hydration_mode, updatedAt: row.updated_at }));
}
