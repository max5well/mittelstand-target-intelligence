import "server-only";
import { z } from "zod";
import { fetchProvider } from "./http";

export type WebSource = {
  provider: "firecrawl" | "tavily";
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
    verifiedDomain: string;
    city?: string;
  }): Promise<WebSource[]>;
}

const FirecrawlSchema = z
  .object({
    success: z.boolean(),
    data: z
      .array(
        z
          .object({
            markdown: z.string().optional(),
            metadata: z
              .object({
                sourceURL: z.string().optional(),
                title: z.string().optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();
export class FirecrawlProvider implements WebResearchProvider {
  readonly name = "firecrawl";
  isAvailable() {
    return (
      Boolean(process.env.FIRECRAWL_API_KEY) ||
      process.env.MOCK_PROVIDERS !== "false"
    );
  }
  async research(input: { companyName: string; verifiedDomain: string }) {
    if (process.env.MOCK_PROVIDERS !== "false")
      return [
        {
          provider: "firecrawl" as const,
          url: input.verifiedDomain,
          title: `${input.companyName} — company website`,
          content:
            "Fictional first-party fixture covering products, industries, locations, management and careers.",
          publishedAt: null,
          score: null,
          retrievedAt: new Date().toISOString(),
        },
      ];
    const payload = await fetchProvider(
      "https://api.firecrawl.dev/v2/crawl",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: input.verifiedDomain,
          limit: 20,
          includePaths: [
            "about*",
            "products*",
            "services*",
            "industries*",
            "management*",
            "news*",
            "press*",
            "careers*",
            "imprint*",
          ],
          excludePaths: ["account*", "cart*", "search*", "calendar*"],
        }),
      },
      FirecrawlSchema,
    );
    return (payload.data ?? []).map((page) => ({
      provider: "firecrawl" as const,
      url: page.metadata?.sourceURL ?? input.verifiedDomain,
      title: page.metadata?.title ?? null,
      content: page.markdown ?? "",
      publishedAt: null,
      score: null,
      retrievedAt: new Date().toISOString(),
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
        score: z.number().optional(),
        published_date: z.string().nullable().optional(),
      })
      .passthrough(),
  ),
});
export class TavilyProvider implements WebResearchProvider {
  readonly name = "tavily";
  isAvailable() {
    return (
      Boolean(process.env.TAVILY_API_KEY) ||
      process.env.MOCK_PROVIDERS !== "false"
    );
  }
  async research(input: {
    companyName: string;
    verifiedDomain: string;
    city?: string;
  }) {
    if (process.env.MOCK_PROVIDERS !== "false")
      return [
        {
          provider: "tavily" as const,
          url: "https://example.com/fictional-news",
          title: `Fictional news about ${input.companyName}`,
          content:
            "Fixture evidence for a management change and planned production expansion.",
          publishedAt: "2026-06-14",
          score: 0.91,
          retrievedAt: new Date().toISOString(),
        },
      ];
    const payload = await fetchProvider(
      "https://api.tavily.com/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `${input.companyName} ${input.city ?? ""} ${input.verifiedDomain}`,
          search_depth: "advanced",
          max_results: 10,
          include_raw_content: true,
        }),
      },
      TavilySchema,
    );
    return payload.results.map((result) => ({
      provider: "tavily" as const,
      url: result.url,
      title: result.title,
      content: result.content,
      publishedAt: result.published_date ?? null,
      score: result.score ?? null,
      retrievedAt: new Date().toISOString(),
    }));
  }
}
