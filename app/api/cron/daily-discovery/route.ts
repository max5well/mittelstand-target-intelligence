import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { searchRunKey } from "@/lib/jobs/backoff";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authorization !== `Bearer ${process.env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    process.env.MOCK_PROVIDERS !== "false" &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  )
    return NextResponse.json({
      mode: "mock",
      enqueued: 2,
      duplicateDeliveriesPrevented: true,
    });
  const supabase = createAdminClient();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const { data: searches, error } = await supabase
    .from("saved_searches")
    .select("id,workspace_id,filters,daily_target")
    .eq("active", true);
  if (error)
    return NextResponse.json(
      { error: "Unable to read schedules" },
      { status: 500 },
    );
  let enqueued = 0;
  for (const search of searches ?? []) {
    const runKey = searchRunKey(search.id, today);
    const { data: run } = await supabase
      .from("search_runs")
      .upsert(
        {
          workspace_id: search.workspace_id,
          saved_search_id: search.id,
          run_key: runKey,
          scheduled_date: today,
          status: "queued",
          exact_filters: search.filters,
        },
        { onConflict: "saved_search_id,run_key", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();
    if (!run) continue;
    await supabase.from("enrichment_jobs").upsert(
      {
        workspace_id: search.workspace_id,
        search_run_id: run.id,
        provider: "openregister",
        job_type: "search",
        status: "queued",
        idempotency_key: `${runKey}:search`,
        payload: { dailyTarget: search.daily_target },
        estimated_credits: 10,
      },
      { onConflict: "workspace_id,idempotency_key", ignoreDuplicates: true },
    );
    enqueued += 1;
  }
  return NextResponse.json({ scheduledDate: today, enqueued });
}
