import { NextResponse } from "next/server";
import { authorizeWorkspaceRequest } from "@/lib/auth/api";
import { getCopilotRun } from "@/lib/data/copilot";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeWorkspaceRequest(request);
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  try {
    const run = await getCopilotRun(auth.workspaceId, id);
    if (!run)
      return NextResponse.json(
        { error: "Recherche nicht gefunden." },
        { status: 404 },
      );
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Recherche konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
