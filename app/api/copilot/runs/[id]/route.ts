import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeWorkspaceRequest } from "@/lib/auth/api";
import { deleteCopilotRun, getCopilotRun } from "@/lib/data/copilot";

export const runtime = "nodejs";

const RunIdSchema = z.string().uuid();

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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeWorkspaceRequest(request, { write: true });
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsedId = RunIdSchema.safeParse((await params).id);
  if (!parsedId.success)
    return NextResponse.json(
      { error: "Ungültige Recherche-ID." },
      { status: 400 },
    );
  try {
    const deleted = await deleteCopilotRun(auth.workspaceId, parsedId.data);
    if (!deleted)
      return NextResponse.json(
        { error: "Recherche nicht gefunden oder noch nicht abgeschlossen." },
        { status: 404 },
      );
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Copilot research delete failed", {
      runId: parsedId.data,
      error: error instanceof Error ? error.message : "Unknown delete error",
    });
    return NextResponse.json(
      { error: "Recherche konnte nicht gelöscht werden." },
      { status: 500 },
    );
  }
}
