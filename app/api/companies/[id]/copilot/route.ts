import { after, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeWorkspaceRequest } from "@/lib/auth/api";
import { CopilotModeSchema } from "@/lib/copilot/types";
import { runCopilotResearch } from "@/lib/copilot/run";
import { createCopilotRun } from "@/lib/data/copilot";
import { getCompanyById } from "@/lib/data/companies";

export const runtime = "nodejs";
export const maxDuration = 300;

const RequestSchema = z.object({
  question: z.string().trim().min(5).max(1_000),
  mode: CopilotModeSchema.default("auto"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeWorkspaceRequest(request, { write: true });
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = RequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          "Bitte geben Sie eine konkrete Frage mit mindestens 5 Zeichen ein.",
      },
      { status: 400 },
    );
  const { id: companyId } = await params;
  const company = await getCompanyById(
    auth.workspaceId,
    auth.userId,
    companyId,
  );
  if (!company)
    return NextResponse.json(
      { error: "Unternehmen nicht gefunden." },
      { status: 404 },
    );
  try {
    const runId = await createCopilotRun({
      workspaceId: auth.workspaceId,
      companyId,
      userId: auth.userId,
      question: parsed.data.question,
      mode: parsed.data.mode,
    });
    after(() =>
      runCopilotResearch({
        runId,
        workspaceId: auth.workspaceId,
        userId: auth.userId,
        companyId,
        question: parsed.data.question,
        mode: parsed.data.mode,
      }),
    );
    return NextResponse.json({ runId, status: "queued" }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Copilot konnte nicht gestartet werden.",
      },
      { status: 500 },
    );
  }
}
