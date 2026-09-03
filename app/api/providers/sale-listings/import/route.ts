import { NextResponse } from "next/server";
import { reportApiError } from "@/lib/api-errors";
import { authorizeWorkspaceRequest } from "@/lib/auth/api";
import {
  importGermanConcessListings,
  isConcessImportEnabled,
} from "@/lib/import/concess";
import { importGermanCovenditListings } from "@/lib/import/covendit";
import { importGermanGroenigListings } from "@/lib/import/groenig";

export const runtime = "nodejs";
export const maxDuration = 60;

type ProviderImporter = {
  provider: string;
  providerLabel: string;
  run: (workspaceId: string) => Promise<{
    provider: string;
    providerLabel: string;
    imported: number;
    updated: number;
    staleMarked: number;
    excludedNonGerman: number;
  }>;
};

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

  const providers: ProviderImporter[] = [
    {
      provider: "covendit",
      providerLabel: "COVENDIT GmbH",
      run: importGermanCovenditListings,
    },
    {
      provider: "groenig",
      providerLabel: "UnternehmensBörse Grönig & Kollegen AG",
      run: importGermanGroenigListings,
    },
  ];
  if (isConcessImportEnabled())
    providers.unshift({
      provider: "concess",
      providerLabel: "con|cess M+A-Partner",
      run: importGermanConcessListings,
    });

  const settled = await Promise.allSettled(
    providers.map((provider) => provider.run(authorization.workspaceId)),
  );
  const results = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failed = await Promise.all(
    settled.flatMap((result, index) => {
      if (result.status === "fulfilled") return [];
      const provider = providers[index] as ProviderImporter;
      return [
        reportApiError(
          result.reason,
          { route: "sale-listings-import", provider: provider.provider },
          `${provider.providerLabel} konnte nicht synchronisiert werden.`,
        ).then((reported) => ({
          provider: provider.provider,
          providerLabel: provider.providerLabel,
          ...reported,
        })),
      ];
    }),
  );

  const totals = results.reduce(
    (sum, result) => ({
      imported: sum.imported + result.imported,
      updated: sum.updated + result.updated,
      staleMarked: sum.staleMarked + result.staleMarked,
      excludedNonGerman: sum.excludedNonGerman + result.excludedNonGerman,
    }),
    { imported: 0, updated: 0, staleMarked: 0, excludedNonGerman: 0 },
  );
  if (!results.length)
    return NextResponse.json(
      {
        error: "Keine Verkaufsplattform konnte synchronisiert werden.",
        failed,
      },
      { status: 502 },
    );

  return NextResponse.json({
    ...totals,
    providers: results,
    failed,
    skipped: isConcessImportEnabled()
      ? []
      : [
          {
            provider: "concess",
            providerLabel: "con|cess M+A-Partner",
            reason: "not-enabled",
          },
        ],
  });
}
