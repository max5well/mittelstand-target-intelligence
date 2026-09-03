import { describe, expect, it } from "vitest";
import { applyAnswerPolicy, deriveAnswerPolicy } from "@/lib/copilot/policy";
import type { CopilotAnswer, ResearchPlan } from "@/lib/copilot/types";

function plan(primaryTask: ResearchPlan["taskTypes"][number]): ResearchPlan {
  return {
    taskTypes: [primaryTask],
    classificationConfidence: 0.95,
    resolvedMode: "standard",
    answerLength: "explained",
    researchGoal: "Answer the question",
    knownContextSummary: "German industrial company",
    subquestions: ["What is supported?"],
    queries: [{ query: "research query", purpose: "evidence", tool: "web" }],
  };
}

function answer(overrides: Partial<CopilotAnswer> = {}): CopilotAnswer {
  return {
    headline: "Ergebnis",
    directAnswer: "Antwort",
    sections: [],
    claims: [],
    benchmark: null,
    contradictions: [],
    limitations: [],
    followUps: [],
    ...overrides,
  };
}

describe("question-type answer policy", () => {
  it("uses a concise comparison profile for financial benchmarking", () => {
    const policy = deriveAnswerPolicy(
      plan("financial_benchmarking"),
      "Wie hoch ist die Bruttomarge vergleichbarer Unternehmen?",
    );

    expect(policy).toMatchObject({
      length: "concise",
      requestedMetric: "gross_margin",
      maxSearches: 2,
      minimumBenchmarkCompanies: 3,
    });
  });

  it("uses explanatory and report profiles for their respective question types", () => {
    expect(
      deriveAnswerPolicy(plan("founder_background"), "Wer ist der Gründer?")
        .length,
    ).toBe("explained");
    expect(
      deriveAnswerPolicy(
        plan("competitive_landscape"),
        "Wie entwickelt sich der Wettbewerb?",
      ).length,
    ).toBe("report");
  });

  it("computes a like-for-like benchmark summary in application code", () => {
    const policy = deriveAnswerPolicy(
      plan("financial_benchmarking"),
      "Wie hoch ist die Bruttomarge vergleichbarer Unternehmen?",
    );
    const result = applyAnswerPolicy(
      answer({
        directAnswer:
          "Model-generated prose that must not control the statistic.",
        benchmark: {
          metric: "gross_margin",
          observations: [
            observation("Peer A", 30),
            {
              ...observation("Peer A", 31),
              period: "FY 2023",
            },
            observation("Peer B", 40),
            observation("Peer C", 35),
            { ...observation("Wrong metric", 99), metric: "ebitda_margin" },
          ],
        },
      }),
      policy,
    );

    expect(result.benchmark?.observations).toHaveLength(3);
    expect(result.directAnswer).toContain("Median der Bruttomarge bei 35 %");
    expect(result.directAnswer).toContain("30 % bis 40 %");
  });

  it("states that fewer than three peers are not a robust benchmark", () => {
    const policy = deriveAnswerPolicy(
      plan("financial_benchmarking"),
      "Wie hoch ist die Bruttomarge vergleichbarer Unternehmen?",
    );
    const result = applyAnswerPolicy(
      answer({
        benchmark: {
          metric: "gross_margin",
          observations: [observation("Only Peer", 36.5)],
        },
      }),
      policy,
    );

    expect(result.directAnswer).toContain("Datenbasis");
    expect(result.limitations[0]).toContain("mindestens 3");
  });
});

function observation(companyName: string, valuePercent: number) {
  return {
    companyName,
    metric: "gross_margin" as const,
    valuePercent,
    period: "FY 2024",
    scope: "consolidated group",
    sourceUrl: `https://example.com/${companyName.toLowerCase().replaceAll(" ", "-")}`,
    sourceKind: "primary" as const,
    comparabilityNote: null,
  };
}
