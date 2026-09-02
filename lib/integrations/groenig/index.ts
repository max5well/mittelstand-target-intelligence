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
  "https://www.unternehmensboerse-abos.de/marktplatz/verkaufsangebote";
const ROBOTS_URL = "https://www.unternehmensboerse-abos.de/robots.txt";

type GroenigCard = Pick<
  PublicSaleListing,
  "listingId" | "title" | "industry" | "tags" | "location" | "sourceUrl"
>;

export async function fetchGermanGroenigListings(): Promise<PublicSaleListingFetchResult> {
  await assertPublicPathAllowed(ROBOTS_URL, LIST_URL);
  const html = await fetchPublicListingHtml(LIST_URL);
  const cards = parseGroenigListingsPage(html);
  if (!cards.length)
    throw new Error("Grönig returned no parseable sale listings");

  const detailed = await mapWithConcurrency(cards, 4, async (card) => {
    const detailHtml = await fetchPublicListingHtml(card.sourceUrl);
    return parseGroenigDetailPage(detailHtml, card);
  });
  const listings = detailed.filter(
    (listing): listing is PublicSaleListing => listing !== null,
  );

  return {
    listings,
    totalOffers: cards.length,
    excludedNonGerman: cards.length - listings.length,
    pagesFetched: 1,
  };
}

export function parseGroenigListingsPage(html: string): GroenigCard[] {
  const cards: GroenigCard[] = [];
  const pattern =
    /<div\b[^>]*class=["'][^"']*offer-item\s+sortable[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<span\b[^>]*class=["']col6["'][^>]*>([\s\S]*?)<\/span>[\s\S]*?<span\b[^>]*class=["']col3["'][^>]*>([\s\S]*?)<\/span>[\s\S]*?<span\b[^>]*class=["']col3["'][^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const href = match[1] ?? "";
    const title = cleanHtmlText(match[2] ?? "");
    const location = cleanHtmlText(match[3] ?? "");
    const revenueCategory = cleanHtmlText(match[4] ?? "");
    const listingId = href.match(/\/verkaufsangebot\/(\d+)(?:-|\/|$)/)?.[1];
    if (!listingId || !title || !href) continue;
    cards.push({
      listingId,
      title,
      industry: title,
      tags: revenueCategory ? [`Umsatzkategorie: ${revenueCategory}`] : [],
      location: location || null,
      sourceUrl: new URL(href, LIST_URL).toString(),
    });
  }
  return cards;
}

export function parseGroenigDetailPage(
  html: string,
  card: GroenigCard,
): PublicSaleListing | null {
  const fields = new Map<string, string>();
  const pattern =
    /<div\b[^>]*class=["'][^"']*labelblock\b[^"']*["'][^>]*>\s*<div\b[^>]*class=["'][^"']*label\s+col4[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div\b[^>]*class=["'][^"']*labelblock-content\s+col8[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  for (const match of html.matchAll(pattern)) {
    fields.set(
      cleanHtmlText(match[1] ?? "").toLocaleLowerCase("de"),
      cleanHtmlText(match[2] ?? ""),
    );
  }
  const location = fields.get("standort") ?? card.location;
  if (isExplicitlyOutsideGermany(location)) return null;

  const financials = fields.get("unternehmenszahlen") ?? "";
  const revenueLine =
    financials.split("\n").find((line) => /^Umsatz\b/i.test(line.trim())) ??
    financials.match(/Umsatz([\s\S]*?)(?:EBIT|Ergebnis|$)/i)?.[0];
  const ebitLine =
    financials
      .split("\n")
      .find((line) => /^Bereinigter EBIT\b/i.test(line.trim())) ??
    financials.split("\n").find((line) => /^EBIT\b/i.test(line.trim()));
  const description =
    fields.get("geschäftsaktivitäten") ??
    fields.get("geschaeftsaktivitäten") ??
    card.title;

  return {
    ...card,
    description,
    industry: fields.get("branche") ?? card.industry,
    location: location || null,
    countryCode: "DE",
    revenueCents: parsePublicGermanEuro(revenueLine),
    ebitCents: parsePublicGermanEuro(ebitLine),
    ebitdaCents: null,
    askingPriceCents: parsePublicGermanEuro(fields.get("verkaufskonditionen")),
    employees: parseFirstInteger(fields.get("personal")),
    foundedYear: parseYear(fields.get("historie")),
  };
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
