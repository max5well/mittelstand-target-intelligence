import { NextResponse } from "next/server";
import { authorizeWorkspaceRequest } from "@/lib/auth/api";
import { reportApiError } from "@/lib/api-errors";
import {
  importGermanConcessListings,
  isConcessImportEnabled,
} from "@/lib/import/concess";

export const runtime = "nodejs";
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
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (!process.env.SUPABASE_SECRET_KEY &&
      !process.env.SUPABASE_SERVER_ACCESS_TOKEN)
  )
    return NextResponse.json(
      { error: "Die Produktionsdatenbank ist nicht konfiguriert." },
      { status: 503 },
    );
  if (!isConcessImportEnabled())
    return NextResponse.json(
      {
        error:
          "Der Import ist deaktiviert, bis die Quelle die automatisierte Übernahme bestätigt hat.",
      },
      { status: 503 },
    );

  try {
    const result = await importGermanConcessListings(authorization.workspaceId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      await reportApiError(
        error,
        { route: "concess-import" },
        "Die deutschen con|cess-Verkaufsangebote konnten nicht synchronisiert werden.",
      ),
      { status: 502 },
    );
  }
}
