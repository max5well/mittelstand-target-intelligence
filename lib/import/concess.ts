import "server-only";

import { fetchGermanConcessListings } from "@/lib/integrations/concess";
import { importPublicSaleListings } from "@/lib/import/public-sale-listings";

export async function importGermanConcessListings(workspaceId: string) {
  if (!isConcessImportEnabled())
    throw new Error(
      "con|cess import is disabled until the source has authorized automated reuse",
    );
  const fetched = await fetchGermanConcessListings();
  return importPublicSaleListings({
    workspaceId,
    provider: "concess",
    providerLabel: "con|cess M+A-Partner",
    fetched,
  });
}

export function isConcessImportEnabled() {
  return process.env.CONCESS_IMPORT_ENABLED === "true";
}
