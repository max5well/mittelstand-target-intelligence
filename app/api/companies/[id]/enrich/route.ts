import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeWorkspaceRequest } from "@/lib/auth/api";
import {
  openRegisterStages,
  runOpenRegisterEnrichment,
} from "@/lib/enrichment/openregister";
import {
  externalProviderStages,
  runExternalProviderEnrichment,
} from "@/lib/enrichment/external-providers";
import { reportApiError } from "@/lib/api-errors";

export const maxDuration = 60;

const RequestSchema = z.object({
  stage: z.union([z.enum(openRegisterStages), z.enum(externalProviderStages)]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeWorkspaceRequest(request, {
    write: true,
  });
  if (!authorization.ok)
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  try {
    const [{ id }, input] = await Promise.all([
      params,
      request.json().then(RequestSchema.parse),
    ]);
    const result = openRegisterStages.includes(
      input.stage as (typeof openRegisterStages)[number],
    )
      ? await runOpenRegisterEnrichment({
          workspaceId: authorization.workspaceId,
          companyId: id,
          stage: input.stage as (typeof openRegisterStages)[number],
        })
      : await runExternalProviderEnrichment({
          workspaceId: authorization.workspaceId,
          companyId: id,
          stage: input.stage as (typeof externalProviderStages)[number],
        });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Ungültige Anreicherungsanfrage." },
        { status: 400 },
      );
    return NextResponse.json(
      await reportApiError(
        error,
        { route: "company-enrichment" },
        "Die Anreicherung ist fehlgeschlagen. Bitte später erneut versuchen.",
      ),
      { status: 502 },
    );
  }
}
