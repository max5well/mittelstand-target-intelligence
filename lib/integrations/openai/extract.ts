import "server-only";
import { z } from "zod";
import type { WebSource } from "../web-research";
import { fetchProvider } from "../http";

export const EvidenceClaimSchema = z.object({
  type: z.enum([
    "description",
    "product",
    "end_market",
    "geography",
    "customer",
    "ownership_signal",
    "succession_signal",
    "material_news",
    "growth_signal",
    "risk",
    "catalyst",
  ]),
  claim: z.string().min(1),
  source_urls: z.array(z.string().url()).min(1),
  supporting_excerpt: z.string().max(500),
  source_date: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});
export const IntelligenceOutputSchema = z.object({
  claims: z.array(EvidenceClaimSchema),
});

const ResponsesApiSchema = z
  .object({
    id: z.string(),
    model: z.string(),
    output_text: z.string(),
    usage: z.record(z.string(), z.number()).optional(),
  })
  .passthrough();

export async function extractIntelligence(sources: WebSource[]) {
  if (process.env.MOCK_PROVIDERS !== "false")
    return {
      output: IntelligenceOutputSchema.parse({
        claims: [
          {
            type: "growth_signal",
            claim: "A fictional production expansion is planned for late 2026.",
            source_urls: [
              sources[0]?.url ?? "https://example.com/fictional-evidence",
            ],
            supporting_excerpt: "Fixture evidence only; no real company claim.",
            source_date: "2026-06-14",
            confidence: 0.82,
          },
        ],
      }),
      model: "mock-evidence-model",
      usage: {},
      promptVersion: "web-intelligence-v1",
      schemaVersion: "1.0",
    };
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL)
    throw new Error("OpenAI extraction is not configured");
  const response = await fetchProvider(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL,
        store: false,
        input: [
          {
            role: "system",
            content:
              "Extract only evidence-backed company intelligence. Omit unsupported claims. Every claim must cite provided source URLs.",
          },
          {
            role: "user",
            content: JSON.stringify(
              sources.map(({ url, title, content, publishedAt }) => ({
                url,
                title,
                content: content.slice(0, 12000),
                publishedAt,
              })),
            ),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "company_intelligence",
            strict: true,
            schema: z.toJSONSchema(IntelligenceOutputSchema),
          },
        },
      }),
    },
    ResponsesApiSchema,
  );
  return {
    output: IntelligenceOutputSchema.parse(JSON.parse(response.output_text)),
    model: response.model,
    usage: response.usage ?? {},
    promptVersion: "web-intelligence-v1",
    schemaVersion: "1.0",
  };
}
