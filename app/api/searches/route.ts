import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeWorkspaceRequest } from "@/lib/auth/api";
import { createAdminClient } from "@/lib/db/admin";
import { runSavedSearch } from "@/lib/discovery/run-saved-search";
import { OpenRegisterFilterSchema } from "@/lib/integrations/openregister";
import { reportApiError } from "@/lib/api-errors";

export const maxDuration = 60;

const CreateSearchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().default(""),
  summary: z.string().trim().min(2).max(1000),
  filters: z.array(OpenRegisterFilterSchema).default([]),
  hydrationMode: z.enum(["lean", "full", "custom"]),
  dailyTarget: z.number().int().min(1).max(100),
  scheduleTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  active: z.boolean(),
  runNow: z.boolean().default(false),
});

export async function POST(request: Request) {
  const authorization = await authorizeWorkspaceRequest(request, {
    write: true,
  });
  if (!authorization.ok)
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );

  try {
    const input = CreateSearchSchema.parse(await request.json());
    const supabase = createAdminClient();
    const hydrationStages =
      input.hydrationMode === "full"
        ? ["details", "financials", "owners", "website_discovery"]
        : input.hydrationMode === "lean"
          ? ["details", "website_discovery"]
          : [];
    const monthlyCreditEstimate =
      (100 + input.dailyTarget * (input.hydrationMode === "full" ? 34 : 14)) *
      30;
    const { data: search, error } = await supabase
      .from("saved_searches")
      .insert({
        workspace_id: authorization.workspaceId,
        name: input.name,
        description: input.description || null,
        filters: input.filters,
        plain_language_summary: input.summary,
        hydration_mode: input.hydrationMode,
        hydration_stages: hydrationStages,
        daily_target: input.dailyTarget,
        schedule_time: input.scheduleTime || null,
        timezone: "Europe/Berlin",
        active: input.active,
        monthly_credit_estimate: monthlyCreditEstimate,
        created_by: null,
      })
      .select(
        "id,workspace_id,filters,daily_target,hydration_mode,hydration_stages",
      )
      .single();
    if (error || !search)
      return NextResponse.json(
        {
          error: "Die Suche konnte nicht gespeichert werden.",
        },
        { status: 500 },
      );

    const run = input.runNow ? await runSavedSearch(search) : null;
    return NextResponse.json({ searchId: search.id, run }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: "Ungültige gespeicherte Suche.",
        },
        { status: 400 },
      );
    return NextResponse.json(
      await reportApiError(
        error,
        { route: "saved-search" },
        "Die Suche konnte nicht eingerichtet werden. Bitte später erneut versuchen.",
      ),
      { status: 502 },
    );
  }
}
