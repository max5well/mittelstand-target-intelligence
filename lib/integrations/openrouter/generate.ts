import "server-only";

import { z } from "zod";
import {
  fetchProvider,
  type ProviderRequestMetrics,
} from "@/lib/integrations/http";
import {
  normalizeOpenRouterResponse,
  type OpenRouterCitation,
  OpenRouterResponseSchema,
  parseStructuredContent,
} from "@/lib/integrations/openrouter/response";

export type StructuredGeneration<T> = {
  output: T;
  model: string;
  requestPayload: Record<string, unknown>;
  usage: Record<string, unknown>;
  requestCount: number;
  durationMs: number;
  estimatedCostMicros: number | null;
  citations: OpenRouterCitation[];
};

export type WebSearchOptions = {
  engine: "native" | "parallel" | "perplexity";
  maxUses: number;
  maxResults: number;
  maxTotalResults: number;
  maxCharacters: number;
};

export async function generateStructured<T>(input: {
  model: string;
  system: string;
  payload: unknown;
  schema: z.ZodType<T>;
  schemaName: string;
  maxTokens?: number;
  fallbackModel?: string;
  webSearch?: WebSearchOptions;
}): Promise<StructuredGeneration<T>> {
  if (!process.env.OPENROUTER_API_KEY)
    throw new Error("OPENROUTER_API_KEY is not configured");
  const startedAt = Date.now();
  const models = Array.from(
    new Set([input.model, input.fallbackModel].filter(Boolean) as string[]),
  );
  let lastError: unknown;

  for (const model of models) {
    try {
      const metrics: ProviderRequestMetrics = { requestCount: 0 };
      const requestPayload = {
        model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: JSON.stringify(input.payload) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: input.schemaName,
            strict: true,
            schema: z.toJSONSchema(input.schema),
          },
        },
        temperature: 0,
        max_tokens: input.maxTokens ?? 4_000,
        stream: false,
        provider: { require_parameters: true },
        plugins: [{ id: "response-healing" }],
        ...(input.webSearch
          ? {
              tools: [
                {
                  type: "openrouter:web_search",
                  parameters: {
                    engine: input.webSearch.engine,
                    max_uses: input.webSearch.maxUses,
                    max_results: input.webSearch.maxResults,
                    max_total_results: input.webSearch.maxTotalResults,
                    max_characters: input.webSearch.maxCharacters,
                  },
                },
              ],
              max_tool_calls: input.webSearch.maxUses,
            }
          : {}),
        store: false,
      };
      const response = await fetchProvider(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
        },
        OpenRouterResponseSchema,
        1,
        metrics,
        55_000,
      );
      const normalized = normalizeOpenRouterResponse(response, model);
      const output = parseStructuredContent(
        normalized.content,
        input.schema,
        normalized.model,
      );
      return {
        output,
        model: normalized.model,
        requestPayload,
        usage: normalized.usage,
        requestCount: Math.max(1, metrics.requestCount),
        durationMs: Date.now() - startedAt,
        estimatedCostMicros:
          normalized.cost === null
            ? null
            : Math.round(normalized.cost * 1_000_000),
        citations: normalized.citations,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("OpenRouter request failed");
}

export const copilotModels = {
  router: process.env.COPILOT_ROUTER_MODEL || "z-ai/glm-5.3-flash",
  quick: process.env.COPILOT_QUICK_MODEL || "z-ai/glm-5.3-flash",
  standard:
    process.env.COPILOT_STANDARD_MODEL || "google/gemini-3-flash-preview",
  deep: process.env.COPILOT_DEEP_MODEL || "openai/gpt-5.4-mini",
  judge: process.env.EVAL_JUDGE_MODEL || "openai/gpt-5.4-mini",
  adjudicator:
    process.env.EVAL_ADJUDICATOR_MODEL || "anthropic/claude-sonnet-4.6",
} as const;
