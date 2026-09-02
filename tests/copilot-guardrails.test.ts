import { describe, expect, it } from "vitest";
import {
  enforcePlanBudget,
  markCitedSources,
  normalizeSources,
  validateAnswerCitations,
} from "@/lib/copilot/run";
import type { ResearchPlan } from "@/lib/copilot/types";
import type { WebSource } from "@/lib/integrations/web-research";

const plan: ResearchPlan = {
  taskTypes: ["financial_benchmarking"],
  classificationConfidence: 0.9,
  resolvedMode: "deep",
  answerLength: "concise",
  researchGoal: "Benchmark margins",
  knownContextSummary: "German manufacturer",
  subquestions: ["Which peers are comparable?"],
  queries: Array.from({ length: 8 }, (_, index) => ({
    query: `peer query ${index}`,
    purpose: "Find peer data",
    tool: "web" as const,
  })),
};

function source(overrides: Partial<WebSource> = {}): WebSource {
  return {
    provider: "exa",
    url: "https://example.com/report",
    title: "Report",
    content:
      "A sufficiently detailed public source passage about a comparable German manufacturer and its reported performance.",
    publishedAt: null,
    score: 0.9,
    retrievedAt: "2026-09-02T12:00:00.000Z",
    ...overrides,
  };
}

describe("Copilot guardrails", () => {
  it("enforces an explicitly requested quick-mode query budget", () => {
    const result = enforcePlanBudget(
      plan,
      "quick",
      "Muster GmbH",
      "Wie hoch ist die Bruttomarge vergleichbarer Unternehmen?",
    );
    expect(result.resolvedMode).toBe("quick");
    expect(result.queries).toHaveLength(2);
    expect(result.answerLength).toBe("concise");
  });

  it("rejects duplicate, unsafe and thin sources", () => {
    const result = normalizeSources(
      [
        source(),
        source({ url: "https://example.com/report?utm_source=test" }),
        source({ url: "http://127.0.0.1/internal" }),
        source({ url: "https://example.org/thin", content: "too short" }),
      ],
      10,
    );
    expect(result.accepted).toHaveLength(1);
    expect(result.all.map((item) => item.rejectionReason)).toEqual([
      undefined,
      "duplicate_url",
      "unsafe_url",
      "insufficient_content",
    ]);
  });

  it("rewrites equivalent citations to the exact source URL and drops unknown citations", () => {
    const output = validateAnswerCitations(
      {
        headline: "Benchmark",
        directAnswer: "Evidence-bound answer.",
        sections: [],
        claims: [
          {
            text: "Supported",
            sourceUrls: ["https://example.com/report/?utm_source=model"],
            confidence: 0.8,
          },
          {
            text: "Fabricated citation",
            sourceUrls: ["https://unknown.example/fake"],
            confidence: 0.9,
          },
        ],
        benchmark: null,
        contradictions: [],
        limitations: [],
        followUps: [],
      },
      [source()],
    );
    expect(output.claims).toEqual([
      {
        text: "Supported",
        sourceUrls: ["https://example.com/report"],
        confidence: 0.8,
      },
    ]);
  });

  it("marks only cited research sources for the primary source list", () => {
    const cited = source();
    const unused = source({ url: "https://example.org/unused" });
    const normalized = normalizeSources([cited, unused], 6);
    const result = markCitedSources(normalized.all, {
      headline: "Benchmark",
      directAnswer: "Answer",
      sections: [],
      claims: [
        {
          text: "Supported",
          sourceUrls: [cited.url],
          confidence: 0.9,
        },
      ],
      benchmark: null,
      contradictions: [],
      limitations: [],
      followUps: [],
    });

    expect(
      result.map(({ url, accepted, rejectionReason }) => ({
        url,
        accepted,
        rejectionReason,
      })),
    ).toEqual([
      { url: cited.url, accepted: true, rejectionReason: undefined },
      { url: unused.url, accepted: false, rejectionReason: "not_cited" },
    ]);
  });
});
