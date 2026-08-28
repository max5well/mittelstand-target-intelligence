import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeWorkspaceRequest } from "@/lib/auth/api";
import { createAdminClient } from "@/lib/db/admin";
import {
  OpenRegisterProvider,
  CompanySearchRequestSchema,
} from "@/lib/integrations/openregister";

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
    const startedAt = Date.now();
    const input = CompanySearchRequestSchema.parse(await request.json());
    const result = await new OpenRegisterProvider().search(input);
    await createAdminClient()
      .from("provider_usage_events")
      .insert({
        workspace_id: authorization.workspaceId,
        provider: "openregister",
        endpoint: "POST /v1/search/company",
        estimated_credits: 10,
        actual_credits: 10,
        request_count: 1,
        http_status: 200,
        duration_ms: Date.now() - startedAt,
      });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: "Invalid OpenRegister-aligned search request",
          details: z.treeifyError(error),
        },
        { status: 400 },
      );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "OpenRegister preview request failed",
      },
      { status: 502 },
    );
  }
}
