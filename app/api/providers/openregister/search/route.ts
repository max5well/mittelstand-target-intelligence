import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeWorkspaceRequest } from "@/lib/auth/api";
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
    const input = CompanySearchRequestSchema.parse(await request.json());
    const result = await new OpenRegisterProvider().search(input);
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
      { error: "Provider request failed" },
      { status: 502 },
    );
  }
}
