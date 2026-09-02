import "server-only";

const CONCESS_OFFERS_URL = "https://matchbridge.de/unternehmensboerse/angebote";
const CONCESS_ROBOTS_URL = "https://matchbridge.de/robots.txt";
const PAGE_SIZE = 12;
const MAX_PAGES = 20;
const REQUEST_TIMEOUT_MS = 15_000;
const PAGE_DELAY_MS = 300;
const ROBOTS_USER_AGENT = "Zielunternehmen";
const USER_AGENT =
  "Zielunternehmen/1.0 (+company-sale-listing synchronization; contact required before enabling)";

export type ConcessListing = {
  listingId: string;
  title: string;
  description: string;
  industry: string | null;
  tags: string[];
  location: string | null;
  countryCode: "DE";
  revenueCents: number | null;
  ebitCents: number | null;
  ebitdaCents: number | null;
  askingPriceCents: number | null;
  employees: number | null;
  foundedYear: number | null;
  sourceUrl: string;
};

export type ConcessFetchResult = {
  listings: ConcessListing[];
  totalOffers: number;
  excludedNonGerman: number;
  pagesFetched: number;
};

export type ParsedConcessListing = Omit<ConcessListing, "countryCode"> & {
  countryCode: "DE" | "AT" | "unknown";
};

export async function fetchGermanConcessListings(): Promise<ConcessFetchResult> {
  await assertRobotsAllowsImport();
  const firstPage = await fetchPage(1);
  const totalOffers = parseOfferCount(firstPage);
  if (totalOffers === null)
    throw new Error(
      "con|cess offer count could not be parsed; markup may have changed",
    );
  const pageCount = Math.min(
    MAX_PAGES,
    Math.max(1, Math.ceil(totalOffers / PAGE_SIZE)),
  );
  const pages = [firstPage];
  for (let page = 2; page <= pageCount; page += 1) {
    await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
    pages.push(await fetchPage(page));
  }
  const parsedPages = pages.map((html, index) =>
    parseConcessListingsPage(html, index + 1),
  );
  if (parsedPages.some((page) => page.length === 0))
    throw new Error(
      "con|cess listing markup changed; import aborted without partial data",
    );
  const parsed = parsedPages.flat();
  const unique = Array.from(
    new Map(parsed.map((listing) => [listing.listingId, listing])).values(),
  );
  if (!unique.length)
    throw new Error("con|cess returned no parseable sale listings");
  const listings = unique.filter(isGermanConcessListing);

  return {
    listings,
    totalOffers: unique.length || totalOffers,
    excludedNonGerman: unique.length - listings.length,
    pagesFetched: pageCount,
  };
}

async function fetchPage(page: number) {
  const url = new URL(CONCESS_OFFERS_URL);
  if (page > 1) url.searchParams.set("page", String(page));
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok)
    throw new Error(
      `con|cess listing request failed with status ${response.status}`,
    );
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html"))
    throw new Error("con|cess returned an unexpected response format");
  return response.text();
}

async function assertRobotsAllowsImport() {
  const response = await fetch(CONCESS_ROBOTS_URL, {
    cache: "no-store",
    headers: { Accept: "text/plain", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status === 404) return;
  if (!response.ok)
    throw new Error(
      `con|cess robots policy could not be verified (status ${response.status})`,
    );
  if (
    !isPathAllowedByRobots(
      await response.text(),
      ROBOTS_USER_AGENT,
      new URL(CONCESS_OFFERS_URL).pathname,
    )
  )
    throw new Error(
      "con|cess robots policy disallows automated listing access",
    );
}

export function isPathAllowedByRobots(
  robots: string,
  userAgent: string,
  path: string,
) {
  const groups: Array<{
    agents: string[];
    rules: Array<{ allow: boolean; path: string }>;
  }> = [];
  let current: (typeof groups)[number] | null = null;
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (!current || current.rules.length) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((field === "allow" || field === "disallow") && current) {
      if (value) current.rules.push({ allow: field === "allow", path: value });
    }
  }
  const agent = userAgent.toLowerCase();
  const exact = groups.filter((group) =>
    group.agents.some(
      (candidate) => candidate !== "*" && agent.includes(candidate),
    ),
  );
  const applicable = exact.length
    ? exact
    : groups.filter((group) => group.agents.includes("*"));
  const matchingRules = applicable
    .flatMap((group) => group.rules)
    .filter((rule) => matchesRobotsPath(path, rule.path))
    .sort(
      (left, right) =>
        right.path.length - left.path.length ||
        Number(right.allow) - Number(left.allow),
    );
  return matchingRules[0]?.allow ?? true;
}

function matchesRobotsPath(path: string, pattern: string) {
  const endAnchored = pattern.endsWith("$");
  const source = (endAnchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map(escapeRegExp)
    .join(".*");
  return new RegExp(`^${source}${endAnchored ? "$" : ""}`).test(path);
}

export function parseConcessListingsPage(
  html: string,
  page: number,
): ParsedConcessListing[] {
  const listings: ParsedConcessListing[] = [];
  const articlePattern =
    /<article\b[^>]*\bid=["']eintrag-([^"']+)["'][^>]*>([\s\S]*?)<\/article>/gi;
  for (const match of html.matchAll(articlePattern)) {
    const listingId = cleanText(match[1] ?? "");
    const article = match[2] ?? "";
    const titleLine = extractClassText(article, "cc-row__title");
    const title = titleLine
      .replace(new RegExp(`^${escapeRegExp(listingId)}\\s*[–-]\\s*`), "")
      .trim();
    if (!listingId || !title) continue;

    const tags = extractClassTexts(article, "cc-row__tag");
    const values = Object.fromEntries(
      Array.from(
        article.matchAll(
          /class=["']cc-databox__k["'][^>]*>([\s\S]*?)<\/div>\s*<div\b[^>]*class=["']cc-databox__v["'][^>]*>([\s\S]*?)<\/div>/gi,
        ),
        (valueMatch) => [
          cleanText(valueMatch[1] ?? ""),
          cleanText(valueMatch[2] ?? ""),
        ],
      ),
    );
    const foundedTag = tags.find((tag) => /^Gegründet\s+\d{4}$/i.test(tag));
    // con|cess assigns D-prefixed listings to its German network and
    // A-prefixed listings to Austria. Unknown prefixes fail closed below.
    const countryCode = listingId.startsWith("D")
      ? "DE"
      : listingId.startsWith("A")
        ? "AT"
        : "unknown";

    listings.push({
      listingId,
      title,
      description: extractClassText(article, "cc-row__teaser"),
      industry:
        tags.find(
          (tag) =>
            !/^(Mehrheit|Minderheit|Nachfolge|Wachstum|Sonstiges|Gegründet\s+\d{4})$/i.test(
              tag,
            ),
        ) ?? null,
      tags,
      location: values.Standort || null,
      countryCode,
      revenueCents: parseGermanCompactEuro(values.Umsatz),
      ebitCents: parseGermanCompactEuro(values.EBIT),
      ebitdaCents: parseGermanCompactEuro(values.EBITDA),
      askingPriceCents: parseGermanCompactEuro(values.Preis),
      employees: parseInteger(values.Mitarbeiter),
      foundedYear: foundedTag ? Number(foundedTag.match(/\d{4}/)?.[0]) : null,
      sourceUrl: `${CONCESS_OFFERS_URL}${page > 1 ? `?page=${page}` : ""}#eintrag-${encodeURIComponent(listingId)}`,
    });
  }
  return listings;
}

export function isGermanConcessListing(
  listing: ParsedConcessListing,
): listing is ConcessListing {
  return listing.countryCode === "DE";
}

export function parseGermanCompactEuro(value?: string) {
  if (!value || /auf Anfrage/i.test(value)) return null;
  const match = value.match(/([\d.,]+)\s*(Tsd|Mio)?/i);
  if (!match) return null;
  const amount = parseGermanNumber(match[1] ?? "");
  if (amount === null) return null;
  const multiplier = /^mio$/i.test(match[2] ?? "")
    ? 1_000_000
    : /^tsd$/i.test(match[2] ?? "")
      ? 1_000
      : 1;
  return Math.round(amount * multiplier * 100);
}

function parseOfferCount(html: string) {
  const match = cleanText(html).match(/(\d+)\s+Angebote\b/i);
  return match?.[1] ? Math.max(1, Number(match[1])) : null;
}

function parseInteger(value?: string) {
  if (!value) return null;
  const normalized = value.replace(/[^\d-]/g, "");
  if (!normalized) return null;
  const result = Number(normalized);
  return Number.isSafeInteger(result) ? result : null;
}

function parseGermanNumber(value: string) {
  const compact = value.replace(/\s/g, "");
  if (!compact) return null;
  const normalized = compact.includes(",")
    ? compact.replaceAll(".", "").replace(",", ".")
    : compact.replaceAll(".", "");
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

function extractClassText(html: string, className: string) {
  const match = html.match(
    new RegExp(
      `<[^>]+class=["'][^"']*\\b${escapeRegExp(className)}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`,
      "i",
    ),
  );
  return cleanText(match?.[1] ?? "");
}

function extractClassTexts(html: string, className: string) {
  const pattern = new RegExp(
    `<[^>]+class=["'][^"']*\\b${escapeRegExp(className)}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`,
    "gi",
  );
  return Array.from(html.matchAll(pattern), (match) =>
    cleanText(match[1] ?? ""),
  );
}

function cleanText(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x?[\da-f]+|[a-z]+);/gi, (entity, key: string) => {
    if (key.startsWith("#")) {
      const hexadecimal = key[1]?.toLowerCase() === "x";
      const point = Number.parseInt(
        key.slice(hexadecimal ? 2 : 1),
        hexadecimal ? 16 : 10,
      );
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
    }
    return named[key.toLowerCase()] ?? entity;
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
