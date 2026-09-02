import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeWorkspaceRequest } from "@/lib/auth/api";
import { createAdminClient } from "@/lib/db/admin";
import {
  OpenRegisterProvider,
  CompanySearchRequestSchema,
} from "@/lib/integrations/openregister";
import { reportApiError } from "@/lib/api-errors";
import type { ProviderRequestMetrics } from "@/lib/integrations/http";

export const maxDuration = 60;

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
    const metrics: ProviderRequestMetrics = { requestCount: 0 };
    const result = await new OpenRegisterProvider().search(input, metrics);
    if (process.env.MOCK_PROVIDERS === "false")
      await createAdminClient()
        .from("provider_usage_events")
        .insert({
          workspace_id: authorization.workspaceId,
          provider: "openregister",
          endpoint: "POST /v1/search/company",
          estimated_credits: 10,
          actual_credits: 10 * Math.max(1, metrics.requestCount),
          request_count: Math.max(1, metrics.requestCount),
          http_status: 200,
          duration_ms: Date.now() - startedAt,
        });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: "Ungültige OpenRegister-Suchanfrage.",
        },
        { status: 400 },
      );
    return NextResponse.json(
      await reportApiError(
        error,
        { route: "openregister-search" },
        "Die OpenRegister-Suche ist fehlgeschlagen. Bitte später erneut versuchen.",
      ),
      { status: 502 },
    );
  }
}
