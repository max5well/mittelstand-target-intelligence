import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractIntelligence,
  OPENROUTER_REQUEST_TIMEOUT_MS,
} from "@/lib/integrations/openrouter/extract";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const source = {
  provider: "firecrawl" as const,
  url: "https://example.de/company",
  title: "Example GmbH",
  content:
    "Example GmbH develops industrial heat exchangers for data centers and chemical plants in Germany.",
  publishedAt: null,
  score: null,
  retrievedAt: "2026-09-02T00:00:00.000Z",
};

describe("OpenRouter evidence extraction", () => {
  it("skips review when no API key is configured", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(
      extractIntelligence("Example GmbH", [source]),
    ).resolves.toBeNull();
  });

  it("uses GLM 5.3 Flash and discards unsupported claims", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        model: "z-ai/glm-5.3-flash",
        choices: [
          {
            message: {
              content: JSON.stringify({
                assessments: [
                  {
                    source_url: source.url,
                    relevance: "relevant",
                    page_type: "company",
                    summary: "Industrial heat exchanger manufacturer.",
                    rejection_reason: null,
                  },
                ],
                claims: [
                  {
                    type: "product",
                    claim: "Develops industrial heat exchangers.",
                    source_urls: [source.url],
                    supporting_excerpt: "develops industrial heat exchangers",
                    source_date: null,
                    confidence: 0.95,
                  },
                  {
                    type: "ownership_signal",
                    claim: "Founder-owned.",
                    source_urls: [source.url],
                    supporting_excerpt: "The founder owns all shares",
                    source_date: null,
                    confidence: 0.9,
                  },
                ],
              }),
            },
          },
        ],
        usage: {
          prompt_tokens: 120,
          completion_tokens: 40,
          total_tokens: 160,
          cost: 0.00012,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractIntelligence("Example GmbH", [source]);

    expect(result?.output.claims).toHaveLength(1);
    expect(result?.output.claims[0].type).toBe("product");
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body));
    expect(body.model).toBe("z-ai/glm-5.3-flash");
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { strict: true },
    });
    expect(body.provider).toEqual({ require_parameters: true });
    expect(body.plugins).toEqual([{ id: "response-healing" }]);
    expect(body.stream).toBe(false);
    expect(body.max_tokens).toBe(4_000);
    expect(result).toMatchObject({
      estimatedTokens: expect.any(Number),
      requestCount: 1,
      usage: { total_tokens: 160, cost: 0.00012 },
    });
    expect(OPENROUTER_REQUEST_TIMEOUT_MS).toBe(40_000);
  });
});
