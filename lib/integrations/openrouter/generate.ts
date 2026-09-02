import "server-only";

import { z } from "zod";
import {
  fetchProvider,
  type ProviderRequestMetrics,
} from "@/lib/integrations/http";

const OpenRouterResponseSchema = z
  .object({
    model: z.string(),
    choices: z
      .array(z.object({ message: z.object({ content: z.string() }) }))
      .min(1),
    usage: z
      .object({
        prompt_tokens: z.number().nonnegative().optional(),
        completion_tokens: z.number().nonnegative().optional(),
        total_tokens: z.number().nonnegative().optional(),
        cost: z.number().nonnegative().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type StructuredGeneration<T> = {
  output: T;
  model: string;
  usage: Record<string, unknown>;
  requestCount: number;
  durationMs: number;
  estimatedCostMicros: number | null;
};

export async function generateStructured<T>(input: {
  model: string;
  system: string;
  payload: unknown;
  schema: z.ZodType<T>;
  schemaName: string;
  maxTokens?: number;
  fallbackModel?: string;
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
      const response = await fetchProvider(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
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
            store: false,
          }),
        },
        OpenRouterResponseSchema,
        1,
        metrics,
        55_000,
      );
      const output = input.schema.parse(
        JSON.parse(response.choices[0].message.content),
      );
      const usage = (response.usage ?? {}) as Record<string, unknown>;
      const cost =
        typeof response.usage?.cost === "number" ? response.usage.cost : null;
      return {
        output,
        model: response.model,
        usage,
        requestCount: Math.max(1, metrics.requestCount),
        durationMs: Date.now() - startedAt,
        estimatedCostMicros:
          cost === null ? null : Math.round(cost * 1_000_000),
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
