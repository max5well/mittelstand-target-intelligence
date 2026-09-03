import "server-only";

import type {
  PublicSaleListing,
  PublicSaleListingFetchResult,
} from "@/lib/import/public-sale-listings";
import {
  assertPublicPathAllowed,
  cleanHtmlText,
  fetchPublicListingHtml,
  isExplicitlyOutsideGermany,
  parseFirstInteger,
  parsePublicGermanEuro,
  parseYear,
} from "@/lib/integrations/public-sale-listing-utils";

const LIST_URL =
  "https://covendit.de/aktuelle-projekte/kategorie/unternehmensverkauf-1/";
const ROBOTS_URL = "https://covendit.de/robots.txt";
const MAX_PAGES = 10;

type CovenditCard = Pick<
  PublicSaleListing,
  "listingId" | "title" | "industry" | "tags" | "sourceUrl"
>;

export async function fetchGermanCovenditListings(): Promise<PublicSaleListingFetchResult> {
  await assertPublicPathAllowed(ROBOTS_URL, LIST_URL);
  const cards: CovenditCard[] = [];
  let page = 1;
  let pagesFetched = 0;
  let nextPage: number | null = 1;

  while (nextPage && page <= MAX_PAGES) {
    const url = page === 1 ? LIST_URL : `${LIST_URL}seite/${page}/`;
    const html = await fetchPublicListingHtml(url);
    pagesFetched += 1;
    cards.push(...parseCovenditListingsPage(html));
    nextPage = parseNextCovenditPage(html);
    if (!nextPage || nextPage <= page) break;
    page = nextPage;
  }

  const uniqueCards = Array.from(
    new Map(cards.map((listing) => [listing.listingId, listing])).values(),
  );
  if (!uniqueCards.length)
    throw new Error("COVENDIT returned no parseable sale listings");

  const detailed = await mapWithConcurrency(uniqueCards, 4, async (card) => {
    const html = await fetchPublicListingHtml(card.sourceUrl);
    return parseCovenditDetailPage(html, card);
  });
  const listings = detailed.filter(
    (listing): listing is PublicSaleListing => listing !== null,
  );

  return {
    listings,
    totalOffers: uniqueCards.length,
    excludedNonGerman: uniqueCards.length - listings.length,
    pagesFetched,
  };
}

export function parseCovenditListingsPage(html: string): CovenditCard[] {
  const cards: CovenditCard[] = [];
  const itemPattern =
    /<li\b[^>]*class=["'][^"']*m-menu-projects__item[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
  for (const itemMatch of html.matchAll(itemPattern)) {
    const item = itemMatch[1] ?? "";
    const title = cleanHtmlText(
      item.match(
        /class=["'][^"']*m-menu-projects__headline[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
      )?.[1] ?? "",
    );
    const idMatch = title.match(/^([A-Z]\d{3})\s*[-–]\s*(.+)$/i);
    const href =
      item.match(
        /<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*m-menu-projects__button/i,
      )?.[1] ?? "";
    if (!idMatch?.[1] || !idMatch[2] || !href) continue;
    const tags = Array.from(
      item.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi),
      (match) => cleanHtmlText(match[1] ?? "").replace(/\s*•\s*$/, ""),
    ).filter(Boolean);
    if (!tags.some((tag) => /Unternehmensverkauf/i.test(tag))) continue;
    const industry = tags.find((tag) => !/Unternehmensverkauf/i.test(tag));

    cards.push({
      listingId: idMatch[1].toUpperCase(),
      title: idMatch[2].trim(),
      industry: industry ?? null,
      tags,
      sourceUrl: new URL(href, LIST_URL).toString(),
    });
  }
  return cards;
}

export function parseCovenditDetailPage(
  html: string,
  card: CovenditCard,
): PublicSaleListing | null {
  const fields = new Map<string, string>();
  for (const match of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const value = cleanHtmlText(match[1] ?? "");
    const separator = value.indexOf(":");
    if (separator <= 0) continue;
    fields.set(
      value.slice(0, separator).trim().toLocaleLowerCase("de"),
      value.slice(separator + 1).trim(),
    );
  }
  const location = fields.get("firmensitz") ?? fields.get("standort") ?? null;
  if (isExplicitlyOutsideGermany(location)) return null;

  const richTextBlocks = Array.from(
    html.matchAll(
      /<div\b[^>]*class=["'][^"']*e-text-rich[^"']*["'][^>]*data-rte[^>]*>([\s\S]*?)<\/div>/gi,
    ),
    (match) => cleanHtmlText(match[1] ?? ""),
  );
  const description =
    richTextBlocks.find(
      (value) =>
        value.length >= 80 &&
        !/Referenznummer:|Newsletter|Datenschutz/i.test(value),
    ) ?? card.title;

  return {
    ...card,
    description,
    location,
    countryCode: "DE",
    revenueCents: parsePublicGermanEuro(
      fields.get("gesamtleistung") ?? fields.get("umsatz"),
    ),
    ebitCents: parsePublicGermanEuro(fields.get("ebit")),
    ebitdaCents: parsePublicGermanEuro(fields.get("ebitda")),
    askingPriceCents: parsePublicGermanEuro(
      fields.get("kaufpreis") ?? fields.get("unternehmenswert"),
    ),
    employees: parseFirstInteger(fields.get("mitarbeiter")),
    foundedYear: parseYear(
      fields.get("gründungsjahr") ?? fields.get("gegründet"),
    ),
  };
}

function parseNextCovenditPage(html: string) {
  const match = html.match(
    /data-fetch-link=["'][^"']*(?:\\\/|\/|%2F)seite(?:\\\/|\/|%2F)(\d+)(?:\\\/|\/|%2F)/i,
  );
  return match?.[1] ? Number(match[1]) : null;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await mapper(values[index] as T);
      }
    }),
  );
  return results;
}
