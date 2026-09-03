import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeWorkspaceRequest } from "@/lib/auth/api";
import { createAdminClient } from "@/lib/db/admin";

const SavedSearchIdSchema = z.string().uuid();

type SavedSearchRouteContext = { params: Promise<{ id: string }> };

export async function DELETE(
  request: Request,
  context: SavedSearchRouteContext,
) {
  const authorization = await authorizeWorkspaceRequest(request, {
    write: true,
  });
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }

  const parsedSearchId = SavedSearchIdSchema.safeParse(
    (await context.params).id,
  );
  if (!parsedSearchId.success) {
    return NextResponse.json({ error: "Ungültige Such-ID" }, { status: 400 });
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (!process.env.SUPABASE_SECRET_KEY &&
      !process.env.SUPABASE_SERVER_ACCESS_TOKEN)
  ) {
    return NextResponse.json(
      { error: "Produktionsdatenbank ist nicht konfiguriert" },
      { status: 503 },
    );
  }

  const searchId = parsedSearchId.data;
  const workspaceId = authorization.workspaceId;
  const supabase = createAdminClient();

  const { data: runs, error: runsError } = await supabase
    .from("search_runs")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("saved_search_id", searchId);
  if (runsError) {
    console.error("[api/searches] search run lookup failed", {
      searchId,
      error: runsError.message,
    });
    return NextResponse.json(
      { error: "Suchhistorie konnte nicht geprüft werden" },
      { status: 500 },
    );
  }

  const runIds = (runs ?? []).map((run) => run.id);
  if (runIds.length) {
    const { data: jobs, error: jobsError } = await supabase
      .from("enrichment_jobs")
      .select("id")
      .eq("workspace_id", workspaceId)
      .in("search_run_id", runIds);
    if (jobsError) {
      console.error("[api/searches] enrichment job lookup failed", {
        searchId,
        error: jobsError.message,
      });
      return NextResponse.json(
        { error: "Verknüpfte Nutzungsdaten konnten nicht geprüft werden" },
        { status: 500 },
      );
    }

    const jobIds = (jobs ?? []).map((job) => job.id);
    if (jobIds.length) {
      const { error: usageError } = await supabase
        .from("provider_usage_events")
        .update({ enrichment_job_id: null })
        .eq("workspace_id", workspaceId)
        .in("enrichment_job_id", jobIds);
      if (usageError) {
        console.error("[api/searches] usage history detach failed", {
          searchId,
          error: usageError.message,
        });
        return NextResponse.json(
          { error: "Verknüpfte Nutzungsdaten konnten nicht erhalten werden" },
          { status: 500 },
        );
      }
    }
  }

  const { data: deleted, error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", searchId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[api/searches] saved search delete failed", {
      searchId,
      error: error.message,
    });
    return NextResponse.json(
      { error: "Gespeicherte Suche konnte nicht gelöscht werden" },
      { status: 500 },
    );
  }
  if (!deleted) {
    return NextResponse.json(
      { error: "Gespeicherte Suche nicht gefunden" },
      { status: 404 },
    );
  }

  return NextResponse.json({ deleted: true });
}
