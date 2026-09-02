import "server-only";

import { fetchGermanGroenigListings } from "@/lib/integrations/groenig";
import { importPublicSaleListings } from "@/lib/import/public-sale-listings";

export async function importGermanGroenigListings(workspaceId: string) {
  const fetched = await fetchGermanGroenigListings();
  return importPublicSaleListings({
    workspaceId,
    provider: "groenig",
    providerLabel: "UnternehmensBörse Grönig & Kollegen AG",
    fetched,
  });
}
