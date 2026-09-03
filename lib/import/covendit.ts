import "server-only";

import { fetchGermanCovenditListings } from "@/lib/integrations/covendit";
import { importPublicSaleListings } from "@/lib/import/public-sale-listings";

export async function importGermanCovenditListings(workspaceId: string) {
  const fetched = await fetchGermanCovenditListings();
  return importPublicSaleListings({
    workspaceId,
    provider: "covendit",
    providerLabel: "COVENDIT GmbH",
    fetched,
  });
}
