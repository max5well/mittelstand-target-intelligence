import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeWorkspaceRequest } from "@/lib/auth/api";
import { createAdminClient } from "@/lib/db/admin";
import { pipelineStatuses, type PipelineStatus } from "@/lib/types";

const CompanyIdSchema = z.string().uuid();
const ArchiveCompanySchema = z.object({ archived: z.boolean() }).strict();
const pipelineStatusSet = new Set<string>(pipelineStatuses);

type CompanyRouteContext = { params: Promise<{ id: string }> };
type WorkspaceAuthorization = Extract<
  Awaited<ReturnType<typeof authorizeWorkspaceRequest>>,
  { ok: true }
>;
type AuthorizedCompany =
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      authorization: WorkspaceAuthorization;
      companyId: string;
      currentStatus: PipelineStatus;
      supabase: ReturnType<typeof createAdminClient>;
    };

async function authorizeCompany(
  request: Request,
  context: CompanyRouteContext,
): Promise<AuthorizedCompany> {
  const authorization = await authorizeWorkspaceRequest(request, {
    write: true,
  });
  if (!authorization.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: authorization.error },
        { status: authorization.status },
      ),
    };
  }

  const parsedCompanyId = CompanyIdSchema.safeParse((await context.params).id);
  if (!parsedCompanyId.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Ungültige Unternehmens-ID" },
        { status: 400 },
      ),
    };
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (!process.env.SUPABASE_SECRET_KEY &&
      !process.env.SUPABASE_SERVER_ACCESS_TOKEN)
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Produktionsdatenbank ist nicht konfiguriert" },
        { status: 503 },
      ),
    };
  }

  const supabase = createAdminClient();
  const { data: company, error } = await supabase
    .from("companies")
    .select("id,status")
    .eq("workspace_id", authorization.workspaceId)
    .eq("id", parsedCompanyId.data)
    .maybeSingle();
  if (error) {
    console.error("[api/companies] company lookup failed", {
      companyId: parsedCompanyId.data,
      error: error.message,
    });
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unternehmen konnte nicht geprüft werden" },
        { status: 500 },
      ),
    };
  }
  if (!company || !pipelineStatusSet.has(company.status)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unternehmen nicht gefunden" },
        { status: 404 },
      ),
    };
  }

  return {
    ok: true,
    authorization,
    companyId: parsedCompanyId.data,
    currentStatus: company.status as PipelineStatus,
    supabase,
  };
}

export async function PATCH(request: Request, context: CompanyRouteContext) {
  const authorized = await authorizeCompany(request, context);
  if (!authorized.ok) return authorized.response;

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültige Archivierungsanfrage" },
      { status: 400 },
    );
  }
  const parsed = ArchiveCompanySchema.safeParse(requestBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Archivierungsanfrage" },
      { status: 400 },
    );
  }

  const wantsArchived = parsed.data.archived;
  if ((authorized.currentStatus === "archived") === wantsArchived) {
    return NextResponse.json({ status: authorized.currentStatus });
  }

  let nextStatus: PipelineStatus = "archived";
  if (!wantsArchived) {
    const { data: archiveEvent, error: eventLookupError } =
      await authorized.supabase
        .from("pipeline_events")
        .select("from_status")
        .eq("workspace_id", authorized.authorization.workspaceId)
        .eq("company_id", authorized.companyId)
        .eq("to_status", "archived")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (eventLookupError) {
      console.error("[api/companies] archive history lookup failed", {
        companyId: authorized.companyId,
        error: eventLookupError.message,
      });
      return NextResponse.json(
        { error: "Archivstatus konnte nicht wiederhergestellt werden" },
        { status: 500 },
      );
    }
    const previousStatus = archiveEvent?.from_status;
    nextStatus =
      previousStatus &&
      previousStatus !== "archived" &&
      pipelineStatusSet.has(previousStatus)
        ? (previousStatus as PipelineStatus)
        : "reviewed";
  }

  const { error: updateError } = await authorized.supabase
    .from("companies")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("workspace_id", authorized.authorization.workspaceId)
    .eq("id", authorized.companyId);
  if (updateError) {
    console.error("[api/companies] status update failed", {
      companyId: authorized.companyId,
      error: updateError.message,
    });
    return NextResponse.json(
      { error: "Archivstatus konnte nicht gespeichert werden" },
      { status: 500 },
    );
  }

  const { error: eventError } = await authorized.supabase
    .from("pipeline_events")
    .insert({
      workspace_id: authorized.authorization.workspaceId,
      company_id: authorized.companyId,
      from_status: authorized.currentStatus,
      to_status: nextStatus,
      changed_by: authorized.authorization.userId,
    });
  if (eventError) {
    console.error("[api/companies] pipeline event insert failed", {
      companyId: authorized.companyId,
      error: eventError.message,
    });
  }

  return NextResponse.json({ status: nextStatus });
}

export async function DELETE(request: Request, context: CompanyRouteContext) {
  const authorized = await authorizeCompany(request, context);
  if (!authorized.ok) return authorized.response;

  const { data: enrichmentJobs, error: jobsError } = await authorized.supabase
    .from("enrichment_jobs")
    .select("id")
    .eq("workspace_id", authorized.authorization.workspaceId)
    .eq("company_id", authorized.companyId);
  if (jobsError) {
    console.error("[api/companies] enrichment job lookup failed", {
      companyId: authorized.companyId,
      error: jobsError.message,
    });
    return NextResponse.json(
      { error: "Verknüpfte Nutzungsdaten konnten nicht geprüft werden" },
      { status: 500 },
    );
  }

  const enrichmentJobIds = (enrichmentJobs ?? []).map((job) => job.id);
  if (enrichmentJobIds.length) {
    const { error: usageError } = await authorized.supabase
      .from("provider_usage_events")
      .update({ enrichment_job_id: null })
      .eq("workspace_id", authorized.authorization.workspaceId)
      .in("enrichment_job_id", enrichmentJobIds);
    if (usageError) {
      console.error("[api/companies] usage history detach failed", {
        companyId: authorized.companyId,
        error: usageError.message,
      });
      return NextResponse.json(
        { error: "Verknüpfte Nutzungsdaten konnten nicht erhalten werden" },
        { status: 500 },
      );
    }
  }

  const { data: deleted, error } = await authorized.supabase
    .from("companies")
    .delete()
    .eq("workspace_id", authorized.authorization.workspaceId)
    .eq("id", authorized.companyId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[api/companies] company delete failed", {
      companyId: authorized.companyId,
      error: error.message,
    });
    return NextResponse.json(
      { error: "Unternehmen konnte nicht gelöscht werden" },
      { status: 500 },
    );
  }
  if (!deleted) {
    return NextResponse.json(
      { error: "Unternehmen nicht gefunden" },
      { status: 404 },
    );
  }

  return NextResponse.json({ deleted: true });
}
