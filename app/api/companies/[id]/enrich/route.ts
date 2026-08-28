import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeWorkspaceRequest } from "@/lib/auth/api";
import {
  openRegisterStages,
  runOpenRegisterEnrichment,
} from "@/lib/enrichment/openregister";

const RequestSchema = z.object({
  stage: z.enum(openRegisterStages),
  force: z.boolean().default(false),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeWorkspaceRequest(request, { write: true });
  if (!authorization.ok)
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  try {
    const [{ id }, input] = await Promise.all([params, request.json().then(RequestSchema.parse)]);
    const result = await runOpenRegisterEnrichment({
      workspaceId: authorization.workspaceId,
      companyId: id,
      stage: input.stage,
      force: input.force,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Invalid enrichment request" }, { status: 400 });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enrichment failed" },
      { status: 502 },
    );
  }
}
