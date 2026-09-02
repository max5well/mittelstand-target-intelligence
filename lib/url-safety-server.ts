import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { SafePublicHttpUrlSchema, isPublicIpAddress } from "@/lib/url-safety";

type LookupResult = { address: string; family: number };
type LookupAll = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<LookupResult[]>;

export async function resolvePublicHttpUrl(
  value: string,
  resolve: LookupAll = lookup,
) {
  const safeUrl = SafePublicHttpUrlSchema.parse(value);
  const hostname = new URL(safeUrl).hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) return safeUrl;
  const addresses = await resolve(hostname, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicIpAddress(address))
  )
    throw new Error(
      "Website hostname resolves to a non-public network address.",
    );
  return safeUrl;
}
