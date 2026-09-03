import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWebsiteVerificationProfile,
  isRelevantTavilySource,
  openRouterDailyTokenLimit,
  selectOfficialWebsiteCandidate,
  selectOfficialWebsiteCandidates,
  verifyOfficialWebsiteEvidence,
} from "@/lib/enrichment/external-providers";
import {
  buildCompanyResearchQuery,
  buildCompanyWebsiteQuery,
  FirecrawlProvider,
  TavilyProvider,
} from "@/lib/integrations/web-research";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Tavily company evidence relevance", () => {
  const source = (title: string, content = "") => ({
    provider: "tavily" as const,
    url: "https://example.com",
    title,
    content,
    publishedAt: null,
    score: 0.9,
    retrievedAt: "2026-08-28T00:00:00.000Z",
  });

  it("keeps sources that contain the German legal-name stem", () => {
    expect(
      isRelevantTavilySource(
        "DW Interieur Construction UG (haftungsbeschränkt)",
        source("DW Interieur Construction UG, Haan"),
      ),
    ).toBe(true);
  });

  it("keeps a distinctive brand match when the legal name adds Germany", () => {
    expect(
      isRelevantTavilySource(
        "Kelvion Germany GmbH",
        source(
          "Kelvion expands its heat exchanger portfolio",
          "Kelvion supplies thermal solutions for industrial customers worldwide.",
        ),
      ),
    ).toBe(true);
  });

  it("keeps first-party sources from the verified website", () => {
    expect(
      isRelevantTavilySource(
        "Kelvion Germany GmbH",
        {
          ...source(
            "Global locations",
            "Worldwide production and service locations",
          ),
          url: "https://www.kelvion.com/company/global-locations",
        },
        "https://kelvion.com",
      ),
    ).toBe(true);
  });

  it("rejects namesakes that do not contain the legal-name stem", () => {
    expect(
      isRelevantTavilySource(
        "DW Interieur Construction UG (haftungsbeschränkt)",
        source("DW Construction", "General contractor in Kansas City"),
      ),
    ).toBe(false);
  });

  it("rejects directory domains when selecting an official website", () => {
    expect(
      selectOfficialWebsiteCandidate(
        "DW Interieur Construction UG (haftungsbeschränkt)",
        [
          {
            ...source("DW Interieur Construction UG, Haan"),
            url: "https://www.companyhouse.de/DW-Interieur-Construction-UG-Haan",
          },
        ],
      ),
    ).toBeNull();
  });

  it("rejects local and medical directories when selecting an official website", () => {
    expect(
      selectOfficialWebsiteCandidates("Anästhesie MVZ Würzburg GmbH", [
        {
          ...source("Anästhesie MVZ Würzburg"),
          url: "https://www.dasoertliche.de/Themen/Anästhesie-MVZ-Würzburg",
        },
        {
          ...source("Anästhesie MVZ Würzburg"),
          url: "https://www.total-lokal.de/branchenbuch/anaesthesie-mvz-wuerzburg.html",
        },
      ]),
    ).toEqual([]);
  });

  it("normalizes a relevant official candidate to its origin", () => {
    expect(
      selectOfficialWebsiteCandidate(
        "DW Interieur Construction UG (haftungsbeschränkt)",
        [
          {
            ...source("DW Interieur Construction UG | Innenausbau in Haan"),
            url: "https://www.dw-interieur.de/impressum",
          },
        ],
      )?.url,
    ).toBe("https://www.dw-interieur.de");
  });

  it("accepts a website for a legal-form successor when independent profile facts agree", () => {
    const result = verifyOfficialWebsiteEvidence(
      {
        companyName: "Anästhesie MVZ Würzburg GmbH",
        city: "Würzburg",
        addressLine: "Schweinfurter Straße 1",
        postcode: "97080",
        representatives: ["Stefan Englert", "Thomas Jarausch"],
      },
      [
        {
          ...source("Impressum - Anästhesie MVZ Würzburg"),
          url: "https://www.anaesthesie-mvz.de/impressum",
          content:
            "Anästhesie MVZ Würzburg GbR, Schweinfurter Str. 1, 97080 Würzburg. Geschäftsführer: Dr. med. Stefan Englert.",
        },
      ],
    );

    expect(result.matched).toBe(true);
    expect(result.signals).toEqual([
      "company_name",
      "city",
      "street_address",
      "postcode",
      "representative",
    ]);
  });

  it("does not accept a name-only website match", () => {
    expect(
      verifyOfficialWebsiteEvidence(
        {
          companyName: "Anästhesie MVZ Würzburg GmbH",
          city: "Würzburg",
          addressLine: "Schweinfurter Straße 1",
          postcode: "97080",
          representatives: ["Stefan Englert"],
        },
        [source("Anästhesie MVZ Würzburg", "Praxis in Würzburg")],
      ).matched,
    ).toBe(false);
  });

  it("searches for the brand without requiring the current legal form", () => {
    expect(
      buildCompanyWebsiteQuery("Anästhesie MVZ Würzburg GmbH", "Würzburg"),
    ).toBe('"Anästhesie MVZ Würzburg" Würzburg Website Impressum');
  });

  it("uses the core brand rather than the legal entity and URL for research", () => {
    expect(buildCompanyResearchQuery("Kelvion Germany GmbH", "Bochum")).toBe(
      '"Kelvion" Bochum Nachrichten Übernahme Investition Expansion Management',
    );
  });

  it("excludes the verified company domain from external research", async () => {
    vi.stubEnv("MOCK_PROVIDERS", "false");
    vi.stubEnv("TAVILY_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        results: [
          {
            url: "https://www.handelsblatt.com/unternehmen/kelvion",
            title: "Kelvion investiert",
            content: "Kelvion plant eine neue Investition in Deutschland.",
            score: 0.9,
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await new TavilyProvider().research({
      companyName: "Kelvion Germany GmbH",
      verifiedDomain: "https://www.kelvion.com/de/",
      city: "Bochum",
    });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      exclude_domains: ["kelvion.com"],
      topic: "news",
    });
  });

  it("uses the search-result address when paid detail hydration is unavailable", () => {
    expect(
      buildWebsiteVerificationProfile({
        companyName: "Wärmetechnik Leickel GmbH",
        rawProviderPayload: {
          address: {
            street: "Beispielstraße 12",
            postal_code: "44623",
            city: "Herne",
          },
        },
      }),
    ).toMatchObject({
      city: "Herne",
      addressLine: "Beispielstraße 12",
      postcode: "44623",
    });
  });
});

describe("OpenRouter spending guard", () => {
  it("uses a bounded default and ignores malformed overrides", () => {
    expect(openRouterDailyTokenLimit()).toBe(100_000);
    expect(openRouterDailyTokenLimit("25000")).toBe(25_000);
    expect(openRouterDailyTokenLimit("unlimited")).toBe(100_000);
  });
});

describe("Firecrawl website discovery", () => {
  it("searches Germany and maps scraped web results into evidence sources", async () => {
    vi.stubEnv("MOCK_PROVIDERS", "false");
    vi.stubEnv("FIRECRAWL_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            web: [
              {
                url: "https://waermetechnik.example/impressum",
                title: "Impressum",
                description: "Wärmetechnik Leickel",
                markdown:
                  "Wärmetechnik Leickel GmbH, Beispielstraße 12, 44623 Herne",
              },
            ],
          },
          creditsUsed: 2,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const sources = await new FirecrawlProvider().discoverOfficialWebsite({
      companyName: "Wärmetechnik Leickel GmbH",
      city: "Herne",
    });

    expect(sources).toEqual([
      expect.objectContaining({
        provider: "firecrawl",
        url: "https://waermetechnik.example/impressum",
        title: "Impressum",
      }),
    ]);
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      query: '"Wärmetechnik Leickel" Herne Website Impressum',
      country: "DE",
      sources: [{ type: "web" }],
    });
    expect(JSON.parse(String(request.body))).not.toHaveProperty(
      "scrapeOptions",
    );
  });

  it("accepts documented array-valued Firecrawl metadata", async () => {
    vi.stubEnv("MOCK_PROVIDERS", "false");
    vi.stubEnv("FIRECRAWL_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          success: true,
          data: {
            markdown: "Unternehmensprofil",
            metadata: {
              sourceURL: "https://example.de",
              title: ["Example GmbH", "Unternehmen"],
            },
          },
          creditsUsed: 1,
        }),
      ),
    );
    await expect(
      new FirecrawlProvider().research({
        companyName: "Example GmbH",
        verifiedDomain: "https://example.de",
      }),
    ).resolves.toEqual([expect.objectContaining({ title: "Example GmbH" })]);
  });
});
