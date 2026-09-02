import "server-only";

const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT =
  "Zielunternehmen/1.0 (+company-sale-listing synchronization)";

export async function fetchPublicListingHtml(url: string) {
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
      `Public sale listing request failed with status ${response.status}`,
    );
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html"))
    throw new Error("Public sale listing source returned an unexpected format");
  return response.text();
}

export async function assertPublicPathAllowed(
  robotsUrl: string,
  listingUrl: string,
) {
  const response = await fetch(robotsUrl, {
    cache: "no-store",
    headers: { Accept: "text/plain", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status === 404) return;
  if (!response.ok)
    throw new Error(
      `Sale listing robots policy could not be verified (status ${response.status})`,
    );
  if (
    !isPathAllowedByRobots(
      await response.text(),
      "Zielunternehmen",
      new URL(listingUrl).pathname,
    )
  )
    throw new Error("Sale listing robots policy disallows automated access");
}

export function cleanHtmlText(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<br\s*\/?>/gi, " \n ")
      .replace(/<[^>]*>/g, " ")
      .replace(/[\t\r ]+/g, " ")
      .replace(/ *\n */g, "\n")
      .trim(),
  );
}

export function parsePublicGermanEuro(value?: string) {
  if (!value || /auf Anfrage/i.test(value)) return null;
  const suffixMatches = Array.from(
    value.matchAll(/([\d.]+(?:,\d+)?)\s*(Tsd\.?|T|Mio\.?)?\s*(?:€|EUR)/gi),
  );
  const prefixMatches = Array.from(
    value.matchAll(/(?:EUR|€)\s*([\d.]+(?:,\d+)?)\s*(Tsd\.?|T|Mio\.?)?/gi),
  );
  const match = suffixMatches.at(-1) ?? prefixMatches.at(-1);
  if (!match) return null;
  const amount = parseGermanNumber(match[1] ?? "");
  if (amount === null) return null;
  const unit = match[2] ?? "";
  const multiplier = /^mio/i.test(unit)
    ? 1_000_000
    : /^(?:tsd|t)/i.test(unit)
      ? 1_000
      : 1;
  return Math.round(amount * multiplier * 100);
}

export function parseYear(value?: string) {
  const match = value?.match(/\b(18\d{2}|19\d{2}|20\d{2}|21\d{2})\b/);
  return match?.[1] ? Number(match[1]) : null;
}

export function parseFirstInteger(value?: string) {
  const match = value?.match(/\b(\d{1,6})\b/);
  if (!match?.[1]) return null;
  const result = Number(match[1]);
  return Number.isSafeInteger(result) ? result : null;
}

export function isExplicitlyOutsideGermany(value?: string | null) {
  return Boolean(
    value &&
      /(?:Österreich|Austria|Schweiz|Switzerland|Suisse|Liechtenstein|Frankreich|France|Italien|Italy|Niederlande|Netherlands|Belgien|Belgium|Polen|Poland|Spanien|Spain|Portugal|Tschechien|Czech(?:ia)?|Dänemark|Denmark)/i.test(
        value,
      ),
  );
}

function isPathAllowedByRobots(
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
  const matches = applicable
    .flatMap((group) => group.rules)
    .filter((rule) => matchesRobotsPath(path, rule.path))
    .sort(
      (left, right) =>
        right.path.length - left.path.length ||
        Number(right.allow) - Number(left.allow),
    );
  return matches[0]?.allow ?? true;
}

function matchesRobotsPath(path: string, pattern: string) {
  const endAnchored = pattern.endsWith("$");
  const source = (endAnchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map(escapeRegExp)
    .join(".*");
  return new RegExp(`^${source}${endAnchored ? "$" : ""}`).test(path);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseGermanNumber(value: string) {
  const compact = value.replace(/\s/g, "");
  if (!compact) return null;
  const normalized = compact.includes(",")
    ? compact.replaceAll(".", "").replace(",", ".")
    : /^\d+\.\d{1,2}$/.test(compact)
      ? compact
      : compact.replaceAll(".", "");
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    euro: "€",
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
