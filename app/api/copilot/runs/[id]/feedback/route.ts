import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeWorkspaceRequest } from "@/lib/auth/api";
import { createAdminClient } from "@/lib/db/admin";
import { getCopilotRun } from "@/lib/data/copilot";

const FeedbackSchema = z.object({
  helpful: z.boolean(),
  comment: z.string().trim().max(1_000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeWorkspaceRequest(request, { write: true });
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = FeedbackSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Ungültiges Feedback." },
      { status: 400 },
    );
  const { id } = await params;
  if (!(await getCopilotRun(auth.workspaceId, id)))
    return NextResponse.json(
      { error: "Recherche nicht gefunden." },
      { status: 404 },
    );
  const { error } = await createAdminClient().from("copilot_feedback").upsert(
    {
      workspace_id: auth.workspaceId,
      research_run_id: id,
      user_id: auth.userId,
      helpful: parsed.data.helpful,
      comment: parsed.data.comment,
    },
    { onConflict: "research_run_id,user_id" },
  );
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
