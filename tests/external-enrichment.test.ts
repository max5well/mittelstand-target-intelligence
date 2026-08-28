import { describe, expect, it } from "vitest";
import {
  isRelevantTavilySource,
  selectOfficialWebsiteCandidate,
} from "@/lib/enrichment/external-providers";

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
});
