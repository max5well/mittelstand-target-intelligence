import "server-only";

import { createAdminClient } from "@/lib/db/admin";

export type StoredJob = {
  id: string;
  companyId: string | null;
  company: string;
  provider: string;
  type: string;
  status: string;
  credits: number;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
};

export async function listJobs(workspaceId: string, companyId?: string): Promise<StoredJob[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVER_ACCESS_TOKEN)) return [];
  const supabase = createAdminClient();
  let query = supabase
    .from("enrichment_jobs")
    .select("id,company_id,provider,job_type,status,estimated_credits,actual_credits,created_at,completed_at,error_details,companies(legal_name)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(companyId ? 20 : 100);
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query;
  if (error) throw new Error(`Unable to load jobs: ${error.message}`);
  return (data ?? []).map((row) => {
    const companyRelation = row.companies as unknown as { legal_name?: string } | null;
    const errorDetails = row.error_details as { message?: string } | null;
    return {
      id: row.id,
      companyId: row.company_id,
      company: companyRelation?.legal_name ?? "Discovery run",
      provider: row.provider,
      type: row.job_type,
      status: row.status,
      credits: Number(row.actual_credits ?? row.estimated_credits ?? 0),
      createdAt: row.created_at,
      completedAt: row.completed_at,
      error: errorDetails?.message ?? null,
    };
  });
}
