import "server-only";
import { z } from "zod";
import { fetchProvider, type ProviderRequestMetrics } from "./http";
import { SafePublicHttpUrlSchema } from "@/lib/url-safety";

export type WebSource = {
  provider: "firecrawl" | "tavily" | "exa" | "openrouter" | "stored";
  url: string;
  title: string | null;
  content: string;
  publishedAt: string | null;
  score: number | null;
  retrievedAt: string;
};
export interface WebResearchProvider {
  readonly name: string;
  isAvailable(): boolean;
  research(input: {
    companyName: string;
    verifiedDomain?: string;
    city?: string;
  }): Promise<WebSource[]>;
}

const FirecrawlSchema = z
  .object({
    success: z.boolean(),
    data: z
      .object({
        markdown: z.string().optional(),
        metadata: z
          .object({
            sourceURL: z.string().optional(),
            title: z.union([z.string(), z.array(z.string())]).optional(),
            description: z.union([z.string(), z.array(z.string())]).optional(),
            language: z.union([z.string(), z.array(z.string())]).optional(),
            keywords: z.union([z.string(), z.array(z.string())]).optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    creditsUsed: z.number().optional(),
  })
  .passthrough();

const FirecrawlSearchSchema = z
  .object({
    success: z.boolean(),
    data: z
      .object({
        web: z
          .array(
            z
              .object({
                url: z.string().url(),
                title: z.string().nullable().optional(),
                description: z.string().nullable().optional(),
                markdown: z.string().nullable().optional(),
              })
              .passthrough(),
          )
          .default([]),
      })
      .passthrough(),
    creditsUsed: z.number().optional(),
  })
  .passthrough();

export class FirecrawlProvider implements WebResearchProvider {
  readonly name = "firecrawl";
  lastRequestCount = 0;
  lastCreditsUsed: number | null = null;
  isAvailable() {
    return (
      Boolean(process.env.FIRECRAWL_API_KEY) ||
      process.env.MOCK_PROVIDERS !== "false"
    );
  }
  async research(input: { companyName: string; verifiedDomain?: string }) {
    if (!input.verifiedDomain)
      throw new Error("Firecrawl requires a verified company website");
    return this.scrapeUrl(input.verifiedDomain, input.companyName);
  }

  async scrapeUrl(url: string, companyName?: string) {
    const safeUrl = SafePublicHttpUrlSchema.parse(url);
    if (process.env.MOCK_PROVIDERS !== "false")
      return [
        {
          provider: "firecrawl" as const,
          url: safeUrl,
          title: `${companyName ?? "Company"} — company website`,
          content:
            "Fictional first-party fixture covering products, industries, locations, management and careers.",
          publishedAt: null,
          score: null,
          retrievedAt: new Date().toISOString(),
        },
      ];
    const metrics: ProviderRequestMetrics = { requestCount: 0 };
    const payload = await fetchProvider(
      "https://api.firecrawl.dev/v2/scrape",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: safeUrl,
          formats: ["markdown"],
          onlyMainContent: true,
          location: { country: "DE", languages: ["de-DE", "en-US"] },
          removeBase64Images: true,
          blockAds: true,
        }),
      },
      FirecrawlSchema,
      3,
      metrics,
    );
    this.lastRequestCount = metrics.requestCount;
    this.lastCreditsUsed = payload.creditsUsed ?? null;
    const page = payload.data;
    return page
      ? [
          {
            provider: "firecrawl" as const,
            url: page.metadata?.sourceURL ?? safeUrl,
            title: firstText(page.metadata?.title),
            content: page.markdown ?? "",
            publishedAt: null,
            score: null,
            retrievedAt: new Date().toISOString(),
          },
        ]
      : [];
  }

  async discoverOfficialWebsite(input: { companyName: string; city?: string }) {
    if (process.env.MOCK_PROVIDERS !== "false")
      return [
        {
          provider: "firecrawl" as const,
          url: "https://example.com",
          title: `${input.companyName} — official website`,
          content: `${input.companyName}, ${input.city ?? "Deutschland"}`,
          publishedAt: null,
          score: null,
          retrievedAt: new Date().toISOString(),
        },
      ];
    const metrics: ProviderRequestMetrics = { requestCount: 0 };
    const payload = await fetchProvider(
      "https://api.firecrawl.dev/v2/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: buildCompanyWebsiteQuery(input.companyName, input.city),
          limit: 10,
          sources: [{ type: "web" }],
          location: input.city ? `${input.city}, Germany` : "Germany",
          country: "DE",
          ignoreInvalidURLs: true,
        }),
      },
      FirecrawlSearchSchema,
      1,
      metrics,
    );
    this.lastRequestCount = metrics.requestCount;
    this.lastCreditsUsed = payload.creditsUsed ?? null;
    const retrievedAt = new Date().toISOString();
    return payload.data.web.map((result) => ({
      provider: "firecrawl" as const,
      url: result.url,
      title: result.title ?? null,
      content: result.markdown ?? result.description ?? "",
      publishedAt: null,
      score: null,
      retrievedAt,
    }));
  }
}

const TavilySchema = z.object({
  results: z.array(
    z
      .object({
        url: z.string().url(),
        title: z.string(),
        content: z.string(),
        raw_content: z.string().nullable().optional(),
        score: z.number().optional(),
        published_date: z.string().nullable().optional(),
      })
      .passthrough(),
  ),
});
export class TavilyProvider implements WebResearchProvider {
  readonly name = "tavily";
  lastRequestCount = 0;
  isAvailable() {
    return (
      Boolean(process.env.TAVILY_API_KEY) ||
      process.env.MOCK_PROVIDERS !== "false"
    );
  }
  async research(input: {
    companyName: string;
    verifiedDomain?: string;
    city?: string;
  }) {
    return this.search(
      buildCompanyResearchQuery(input.companyName, input.city),
      {
        maxResults: 10,
        topic: "news",
        excludeDomains: input.verifiedDomain
          ? [websiteHostname(input.verifiedDomain)]
          : undefined,
      },
    );
  }

  async search(
    query: string,
    options: {
      maxResults?: number;
      topic?: "general" | "news";
      excludeDomains?: string[];
    } = {},
  ) {
    if (process.env.MOCK_PROVIDERS !== "false")
      return [
        {
          provider: "tavily" as const,
          url: "https://example.com/fictional-news",
          title: `Fictional result for ${query}`,
          content:
            "Fixture evidence for a management change and planned production expansion.",
          publishedAt: "2026-06-14",
          score: 0.91,
          retrievedAt: new Date().toISOString(),
        },
      ];
    const metrics: ProviderRequestMetrics = { requestCount: 0 };
    const payload = await fetchProvider(
      "https://api.tavily.com/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          search_depth: "advanced",
          topic: options.topic ?? "general",
          max_results: Math.min(Math.max(options.maxResults ?? 5, 1), 10),
          include_raw_content: true,
          exclude_domains: options.excludeDomains,
        }),
      },
      TavilySchema,
      3,
      metrics,
    );
    this.lastRequestCount = metrics.requestCount;
    return mapTavilyResults(payload.results);
  }

  async discoverOfficialWebsite(input: { companyName: string; city?: string }) {
    if (process.env.MOCK_PROVIDERS !== "false") return this.research(input);
    const metrics: ProviderRequestMetrics = { requestCount: 0 };
    const payload = await fetchProvider(
      "https://api.tavily.com/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: buildCompanyWebsiteQuery(input.companyName, input.city),
          search_depth: "advanced",
          max_results: 10,
          include_raw_content: "markdown",
          country: "germany",
          language: "de",
        }),
      },
      TavilySchema,
      1,
      metrics,
    );
    this.lastRequestCount = metrics.requestCount;
    return mapTavilyResults(payload.results);
  }
}

function firstText(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.find((item) => item.trim()) ?? null;
  return value?.trim() || null;
}

export function buildCompanyWebsiteQuery(companyName: string, city?: string) {
  const brandName = companyBrandName(companyName);
  return `\"${brandName || companyName}\" ${city ?? "Deutschland"} Website Impressum`;
}

export function buildCompanyResearchQuery(companyName: string, city?: string) {
  const brandName = companyBrandName(companyName).replace(
    /\s+(?:germany|deutschland)$/i,
    "",
  );
  return `\"${brandName || companyName}\" ${city ?? "Deutschland"} Nachrichten Übernahme Investition Expansion Management`;
}

function websiteHostname(value: string) {
  return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
}

function companyBrandName(companyName: string) {
  return companyName
    .replace(
      /\s+(?:gmbh|ag|ug|kg|ohg|se|gbr|egbr)(?:\s*\(haftungsbeschr[aä]nkt\))?\s*$/i,
      "",
    )
    .trim();
}

function mapTavilyResults(results: z.infer<typeof TavilySchema>["results"]) {
  const retrievedAt = new Date().toISOString();
  return results.map((result) => ({
    provider: "tavily" as const,
    url: result.url,
    title: result.title,
    content: result.raw_content ?? result.content,
    publishedAt: result.published_date ?? null,
    score: result.score ?? null,
    retrievedAt,
  }));
}
