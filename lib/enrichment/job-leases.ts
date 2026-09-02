import "server-only";

import type { createAdminClient } from "@/lib/db/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type ActiveEnrichmentJob = {
  id: string;
  status: string;
  actual_credits: number | null;
  completed_at: string | null;
  payload: unknown;
  lease_expires_at: string | null;
};

export function isExpiredLease(
  leaseExpiresAt: string | null,
  now = Date.now(),
) {
  if (!leaseExpiresAt) return true;
  const expiresAt = Date.parse(leaseExpiresAt);
  return !Number.isFinite(expiresAt) || expiresAt < now;
}

export async function recoverConflictingJobLease(
  supabase: AdminClient,
  input: {
    workspaceId: string;
    companyId: string;
    provider: string;
    jobType: string;
  },
): Promise<{ retry: boolean; active: ActiveEnrichmentJob | null }> {
  const { data: active, error: activeError } = await supabase
    .from("enrichment_jobs")
    .select("id,status,actual_credits,completed_at,payload,lease_expires_at")
    .eq("workspace_id", input.workspaceId)
    .eq("company_id", input.companyId)
    .eq("provider", input.provider)
    .eq("job_type", input.jobType)
    .eq("status", "running")
    .maybeSingle();
  if (activeError) throw new Error(activeError.message);
  if (!active) return { retry: false, active: null };
  const typedActive = active as ActiveEnrichmentJob;
  if (!isExpiredLease(typedActive.lease_expires_at))
    return { retry: false, active: typedActive };

  const completedAt = new Date().toISOString();
  let recoveryQuery = supabase
    .from("enrichment_jobs")
    .update({
      status: "failed",
      completed_at: completedAt,
      lease_expires_at: null,
      error_details: {
        message: "Expired provider-job lease recovered before retry.",
        reason: "expired_lease_recovered",
      },
    })
    .eq("id", typedActive.id)
    .eq("status", "running");
  recoveryQuery = typedActive.lease_expires_at
    ? recoveryQuery.eq("lease_expires_at", typedActive.lease_expires_at)
    : recoveryQuery.is("lease_expires_at", null);
  const { data: recovered, error: recoveryError } = await recoveryQuery
    .select("id")
    .maybeSingle();
  if (recoveryError) throw new Error(recoveryError.message);
  return { retry: Boolean(recovered), active: recovered ? null : typedActive };
}
