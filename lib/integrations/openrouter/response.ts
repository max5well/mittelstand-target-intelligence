import { z } from "zod";

/**
 * OpenRouter normalizes many providers, but optional metadata can still vary by
 * upstream model. Keep the transport envelope deliberately permissive and
 * validate the generated business object with its strict call-site schema.
 */
export const OpenRouterResponseSchema = z
  .object({
    model: z.unknown().optional(),
    choices: z
      .array(
        z
          .object({
            finish_reason: z.unknown().optional(),
            message: z
              .object({
                content: z.unknown().optional(),
                refusal: z.unknown().optional(),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .optional(),
    usage: z.unknown().optional(),
    error: z.unknown().optional(),
  })
  .passthrough();

type OpenRouterResponse = z.infer<typeof OpenRouterResponseSchema>;

export type OpenRouterUsage = Record<string, unknown> & {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number | null;
};

export function normalizeOpenRouterResponse(
  response: OpenRouterResponse,
  requestedModel: string,
) {
  const model =
    typeof response.model === "string" && response.model.trim()
      ? response.model
      : requestedModel;
  const providerError = asRecord(response.error);
  if (providerError) {
    const code = scalarLabel(providerError.code);
    throw new Error(
      `OpenRouter model ${model} returned an API error${code ? ` (${code})` : ""}.`,
    );
  }

  const choice = response.choices?.[0];
  if (!choice)
    throw new Error(`OpenRouter model ${model} returned no completion choice.`);

  const content = textContent(choice.message.content);
  if (!content) {
    const refusal = scalarLabel(choice.message.refusal);
    const finishReason = scalarLabel(choice.finish_reason) ?? "unknown";
    const reason = refusal
      ? ` refused the request: ${refusal}`
      : ` returned no structured text (finish reason: ${finishReason})`;
    throw new Error(`OpenRouter model ${model}${reason}.`);
  }

  const usage = normalizeUsage(response.usage);
  return {
    model,
    content,
    usage,
    cost: usage.cost ?? null,
  };
}

function normalizeUsage(value: unknown): OpenRouterUsage {
  const raw = asRecord(value) ?? {};
  const usage: OpenRouterUsage = { ...raw };
  for (const key of [
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
  ] as const) {
    const number = finiteNumber(raw[key]);
    if (number === null) delete usage[key];
    else usage[key] = Math.trunc(number);
  }
  const cost = finiteNumber(raw.cost);
  if (cost === null) {
    if (raw.cost === null) usage.cost = null;
    else delete usage.cost;
  } else usage.cost = cost;
  return usage;
}

export function parseStructuredContent<T>(
  content: string,
  schema: z.ZodType<T>,
  model: string,
) {
  let decoded: unknown;
  try {
    decoded = JSON.parse(jsonCandidate(content));
  } catch {
    throw new Error(`OpenRouter model ${model} returned malformed JSON.`);
  }
  const parsed = schema.safeParse(decoded);
  if (!parsed.success) {
    const paths = Array.from(
      new Set(
        parsed.error.issues.map((issue) =>
          issue.path.length ? issue.path.join(".") : "<root>",
        ),
      ),
    )
      .slice(0, 5)
      .join(", ");
    throw new Error(
      `OpenRouter model ${model} returned JSON that failed the requested schema at ${paths}.`,
    );
  }
  return parsed.data;
}

function textContent(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    const text = value
      .map((part) => {
        if (typeof part === "string") return part;
        const record = asRecord(part);
        if (!record) return "";
        if (typeof record.text === "string") return record.text;
        if (typeof record.content === "string") return record.content;
        return "";
      })
      .join("")
      .trim();
    return text || null;
  }
  const record = asRecord(value);
  return record ? JSON.stringify(record) : null;
}

function jsonCandidate(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1];
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart)
    return trimmed.slice(objectStart, objectEnd + 1);
  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart)
    return trimmed.slice(arrayStart, arrayEnd + 1);
  return trimmed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function scalarLabel(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null;
}

function finiteNumber(value: unknown) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(number) && number >= 0 ? number : null;
}
