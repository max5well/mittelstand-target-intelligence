import { describe, expect, it } from "vitest";
import {
  deduplicateCopilotSources,
  type CopilotSourceInput,
} from "@/lib/data/copilot";

function source(
  url: string,
  canonicalUrl: string,
  decision: CopilotSourceInput["decision"],
): CopilotSourceInput {
  return {
    provider: "exa",
    url,
    canonicalUrl,
    title: "Source",
    decision,
  };
}

describe("Copilot source persistence", () => {
  it("sends each canonical URL to an upsert only once", () => {
    const sources = deduplicateCopilotSources([
      source(
        "https://example.com/report?utm_source=exa",
        "https://example.com/report",
        "rejected",
      ),
      source(
        "https://example.com/report",
        "https://example.com/report",
        "accepted",
      ),
      source(
        "https://example.org/peer",
        "https://example.org/peer",
        "accepted",
      ),
    ]);

    expect(sources).toHaveLength(2);
    expect(sources[0]).toMatchObject({
      url: "https://example.com/report",
      decision: "accepted",
    });
    expect(new Set(sources.map((item) => item.canonicalUrl)).size).toBe(2);
  });
});
