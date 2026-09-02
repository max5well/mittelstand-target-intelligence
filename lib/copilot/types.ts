import { z } from "zod";

export const CopilotModeSchema = z.enum(["auto", "quick", "deep"]);
export const ResolvedCopilotModeSchema = z.enum(["quick", "standard", "deep"]);
export const AnswerLengthSchema = z.enum(["concise", "explained", "report"]);
export const CopilotTaskTypeSchema = z.enum([
  "founder_background",
  "financial_benchmarking",
  "comparable_companies",
  "competitive_landscape",
  "customers_suppliers",
  "market_expansion",
  "ownership_succession",
  "technology_capabilities",
  "general",
]);

export const ResearchPlanSchema = z.object({
  taskTypes: z.array(CopilotTaskTypeSchema).min(1).max(3),
  classificationConfidence: z.number().min(0).max(1),
  resolvedMode: ResolvedCopilotModeSchema,
  answerLength: AnswerLengthSchema,
  researchGoal: z.string().min(1).max(500),
  knownContextSummary: z.string().max(1_500),
  subquestions: z.array(z.string().min(1).max(300)).min(1).max(8),
  queries: z
    .array(
      z.object({
        query: z.string().min(2).max(400),
        purpose: z.string().min(1).max(300),
        tool: z.enum(["exa", "tavily", "both"]),
      }),
    )
    .min(1)
    .max(10),
});

export const CopilotAnswerSchema = z.object({
  headline: z.string().min(1).max(200),
  directAnswer: z.string().min(1).max(4_000),
  sections: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        content: z.string().min(1).max(4_000),
      }),
    )
    .max(8),
  claims: z
    .array(
      z.object({
        text: z.string().min(1).max(700),
        sourceUrls: z.array(z.string().url()).min(1).max(5),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(30),
  contradictions: z.array(z.string().max(700)).max(10),
  limitations: z.array(z.string().max(700)).max(10),
  followUps: z.array(z.string().max(300)).max(5),
});

export type CopilotMode = z.infer<typeof CopilotModeSchema>;
export type ResearchPlan = z.infer<typeof ResearchPlanSchema>;
export type CopilotAnswer = z.infer<typeof CopilotAnswerSchema>;

export type CopilotRunView = {
  id: string;
  companyId: string | null;
  question: string;
  requestedMode: CopilotMode;
  resolvedMode: "quick" | "standard" | "deep" | null;
  answerLength: "concise" | "explained" | "report" | null;
  taskTypes: string[];
  status:
    | "queued"
    | "planning"
    | "researching"
    | "synthesizing"
    | "completed"
    | "failed"
    | "cancelled";
  answer: string | null;
  answerPayload: Partial<CopilotAnswer>;
  modelRoute: Record<string, unknown>;
  tokenUsage: Record<string, unknown>;
  estimatedCostMicros: number | null;
  latencyMs: number | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  sources: Array<{
    id: string;
    provider: string;
    url: string;
    title: string | null;
    excerpt: string | null;
  }>;
};
