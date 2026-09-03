import type { CopilotAnswer, ResearchPlan } from "@/lib/copilot/types";

export type AnswerPolicy = {
  length: ResearchPlan["answerLength"];
  maxOutputTokens: number;
  maxDirectAnswerChars: number;
  maxSections: number;
  maxSectionChars: number;
  maxClaims: number;
  maxSearches: number;
  maxSources: number;
  resultsPerSearch: number;
  sourceChars: number;
  requestedMetric: NonNullable<CopilotAnswer["benchmark"]>["metric"] | null;
  minimumBenchmarkCompanies: number;
};

type TaskType = ResearchPlan["taskTypes"][number];

const policies: Record<TaskType, Omit<AnswerPolicy, "requestedMetric">> = {
  financial_benchmarking: {
    length: "concise",
    maxOutputTokens: 1_800,
    maxDirectAnswerChars: 900,
    maxSections: 1,
    maxSectionChars: 1_000,
    maxClaims: 4,
    maxSearches: 2,
    maxSources: 6,
    resultsPerSearch: 3,
    sourceChars: 2_000,
    minimumBenchmarkCompanies: 3,
  },
  comparable_companies: {
    length: "explained",
    maxOutputTokens: 2_400,
    maxDirectAnswerChars: 1_200,
    maxSections: 2,
    maxSectionChars: 1_400,
    maxClaims: 6,
    maxSearches: 2,
    maxSources: 6,
    resultsPerSearch: 3,
    sourceChars: 2_000,
    minimumBenchmarkCompanies: 0,
  },
  founder_background: explainedPolicy(),
  ownership_succession: explainedPolicy(),
  customers_suppliers: explainedPolicy(),
  technology_capabilities: explainedPolicy(),
  competitive_landscape: reportPolicy(),
  market_expansion: reportPolicy(),
  general: {
    length: "concise",
    maxOutputTokens: 1_800,
    maxDirectAnswerChars: 1_000,
    maxSections: 1,
    maxSectionChars: 1_000,
    maxClaims: 4,
    maxSearches: 1,
    maxSources: 4,
    resultsPerSearch: 4,
    sourceChars: 2_000,
    minimumBenchmarkCompanies: 0,
  },
};

export function deriveAnswerPolicy(
  plan: ResearchPlan,
  question: string,
): AnswerPolicy {
  const requestedMetric = metricFromQuestion(question);
  const primaryTask = plan.taskTypes[0] ?? "general";
  const base = requestedMetric
    ? policies.financial_benchmarking
    : policies[primaryTask];
  return { ...base, requestedMetric };
}

export function answerPolicyInstructions(policy: AnswerPolicy) {
  const instructions = [
    `Response profile: ${policy.length}, selected from the primary question type.`,
    `Keep directAnswer under ${policy.maxDirectAnswerChars} characters.`,
    `Use no more than ${policy.maxSections} sections, ${policy.maxSectionChars} characters each, and ${policy.maxClaims} cited claims.`,
    "Do not repeat the direct answer in sections or claims.",
  ];
  if (policy.requestedMetric) {
    instructions.push(
      `The requested financial metric is ${policy.requestedMetric}. Do not substitute EBITDA, EBIT, operating or net margin for another metric.`,
      `Return benchmark observations for 3 to 5 genuinely comparable companies when evidence permits; every observation must use ${policy.requestedMetric}.`,
      "Keep periods and entity scope comparable. Prefer annual reports and investor-relations sources over aggregators.",
      "If fewer than 3 valid companies are available, say that the evidence is insufficient for a robust benchmark rather than padding the sample with another metric.",
    );
  } else {
    instructions.push(
      "Set benchmark to null unless the question explicitly requests a financial-margin comparison.",
    );
  }
  return instructions.join(" ");
}

export function applyAnswerPolicy(
  answer: CopilotAnswer,
  policy: AnswerPolicy,
): CopilotAnswer {
  const benchmark = validateBenchmark(answer.benchmark, policy);
  const limited: CopilotAnswer = {
    ...answer,
    directAnswer: trimAtBoundary(
      answer.directAnswer,
      policy.maxDirectAnswerChars,
    ),
    sections: answer.sections
      .filter(
        (section) =>
          !policy.requestedMetric ||
          !substitutesAnotherMargin(section.content, policy.requestedMetric),
      )
      .slice(0, policy.maxSections)
      .map((section) => ({
        ...section,
        content: trimAtBoundary(section.content, policy.maxSectionChars),
      })),
    claims: answer.claims
      .filter(
        (claim) =>
          !policy.requestedMetric ||
          !substitutesAnotherMargin(claim.text, policy.requestedMetric),
      )
      .slice(0, policy.maxClaims),
    contradictions: answer.contradictions.slice(0, 3),
    limitations: answer.limitations.slice(0, 3),
    followUps: answer.followUps.slice(0, 3),
    benchmark,
  };
  if (!policy.requestedMetric) return limited;
  return enforceBenchmarkSummary(limited, policy);
}

function validateBenchmark(
  benchmark: CopilotAnswer["benchmark"],
  policy: AnswerPolicy,
) {
  if (!benchmark || !policy.requestedMetric) return null;
  const seen = new Set<string>();
  const observations = benchmark.observations.filter((observation) => {
    const key = observation.companyName.trim().toLowerCase();
    if (observation.metric !== policy.requestedMetric || seen.has(key))
      return false;
    seen.add(key);
    return true;
  });
  return { metric: policy.requestedMetric, observations };
}

function enforceBenchmarkSummary(
  answer: CopilotAnswer,
  policy: AnswerPolicy,
): CopilotAnswer {
  const observations = answer.benchmark?.observations ?? [];
  const metric = metricLabel(policy.requestedMetric!);
  if (observations.length < policy.minimumBenchmarkCompanies) {
    const limitation = `Für einen belastbaren Vergleich werden mindestens ${policy.minimumBenchmarkCompanies} vergleichbare Unternehmen mit derselben Kennzahl benötigt; gefunden wurden ${observations.length}.`;
    return {
      ...answer,
      directAnswer:
        observations.length === 0
          ? `Die Recherche lieferte keine ausreichend vergleichbaren, öffentlich belegten Werte für die ${metric}.`
          : `Die Datenbasis ist für einen belastbaren Vergleich der ${metric} noch zu klein: Es wurden nur ${observations.length} vergleichbare Unternehmen mit derselben Kennzahl gefunden.`,
      limitations: [
        limitation,
        ...answer.limitations.filter((item) => item !== limitation),
      ].slice(0, 3),
    };
  }
  const values = observations
    .map((item) => item.valuePercent)
    .sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  const median =
    values.length % 2 === 0
      ? (values[middle - 1] + values[middle]) / 2
      : values[middle];
  return {
    ...answer,
    directAnswer: `Für die kleine Vergleichsgruppe von ${observations.length} Unternehmen liegt der Median der ${metric} bei ${formatPercent(median)}; die Spanne reicht von ${formatPercent(values[0])} bis ${formatPercent(values.at(-1)!)}.`,
  };
}

function metricFromQuestion(question: string): AnswerPolicy["requestedMetric"] {
  const normalized = question.toLowerCase();
  if (/bruttomarge|gross\s*margin/.test(normalized)) return "gross_margin";
  if (/ebitda[ -]?marge|ebitda\s*margin/.test(normalized))
    return "ebitda_margin";
  if (/ebit[ -]?marge|ebit\s*margin/.test(normalized)) return "ebit_margin";
  if (/operative\s+marge|operating\s*margin/.test(normalized))
    return "operating_margin";
  if (/netto(?:gewinn)?marge|net\s*margin/.test(normalized))
    return "net_margin";
  return null;
}

function substitutesAnotherMargin(
  text: string,
  requested: NonNullable<AnswerPolicy["requestedMetric"]>,
) {
  const normalized = text.toLowerCase();
  const mentioned = new Set<NonNullable<AnswerPolicy["requestedMetric"]>>();
  if (/bruttomarge|gross\s*margin/.test(normalized))
    mentioned.add("gross_margin");
  if (/ebitda[ -]?marge|ebitda\s*margin/.test(normalized))
    mentioned.add("ebitda_margin");
  if (/ebit[ -]?marge|ebit\s*margin/.test(normalized))
    mentioned.add("ebit_margin");
  if (/operative\s+marge|operating\s*margin/.test(normalized))
    mentioned.add("operating_margin");
  if (/netto(?:gewinn)?marge|net\s*margin/.test(normalized))
    mentioned.add("net_margin");
  return mentioned.size > 0 && !mentioned.has(requested);
}

function explainedPolicy(): Omit<AnswerPolicy, "requestedMetric"> {
  return {
    length: "explained",
    maxOutputTokens: 2_600,
    maxDirectAnswerChars: 1_200,
    maxSections: 3,
    maxSectionChars: 1_500,
    maxClaims: 8,
    maxSearches: 2,
    maxSources: 8,
    resultsPerSearch: 4,
    sourceChars: 2_500,
    minimumBenchmarkCompanies: 0,
  };
}

function reportPolicy(): Omit<AnswerPolicy, "requestedMetric"> {
  return {
    length: "report",
    maxOutputTokens: 4_000,
    maxDirectAnswerChars: 1_500,
    maxSections: 5,
    maxSectionChars: 2_000,
    maxClaims: 12,
    maxSearches: 4,
    maxSources: 12,
    resultsPerSearch: 4,
    sourceChars: 3_000,
    minimumBenchmarkCompanies: 0,
  };
}

function trimAtBoundary(value: string, maximum: number) {
  if (value.length <= maximum) return value;
  const shortened = value.slice(0, maximum + 1);
  const sentence = shortened.match(/^([\s\S]*[.!?])(?:\s|$)/)?.[1];
  if (sentence && sentence.length >= maximum * 0.6) return sentence;
  const word = shortened.slice(0, shortened.lastIndexOf(" ")).trimEnd();
  return `${word || value.slice(0, maximum).trimEnd()}…`;
}

function metricLabel(metric: NonNullable<AnswerPolicy["requestedMetric"]>) {
  return {
    gross_margin: "Bruttomarge",
    ebitda_margin: "EBITDA-Marge",
    ebit_margin: "EBIT-Marge",
    operating_margin: "operativen Marge",
    net_margin: "Nettomarge",
  }[metric];
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value)} %`;
}
