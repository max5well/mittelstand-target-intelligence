import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { generateStructured } from "@/lib/integrations/openrouter/generate";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("OpenRouter structured generation", () => {
  it("returns the exact request body that was sent to the provider", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        model: "test/model",
        choices: [{ message: { content: JSON.stringify({ answer: "ok" }) } }],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 4,
          total_tokens: 12,
          cost: null,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStructured({
      model: "test/model",
      system: "Use all supplied context.",
      payload: { company: "Muster GmbH", facts: ["A", "B"] },
      schema: z.object({ answer: z.string() }),
      schemaName: "test_answer",
      maxTokens: 500,
    });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sentPayload = JSON.parse(String(request.body));
    expect(result.requestPayload).toEqual(sentPayload);
    expect(result.requestPayload).toMatchObject({
      model: "test/model",
      messages: [
        { role: "system", content: "Use all supplied context." },
        {
          role: "user",
          content: JSON.stringify({
            company: "Muster GmbH",
            facts: ["A", "B"],
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "test_answer", strict: true },
      },
      temperature: 0,
      max_tokens: 500,
      provider: { require_parameters: true },
      plugins: [{ id: "response-healing" }],
      store: false,
    });
    expect(result.estimatedCostMicros).toBeNull();
  });

  it("falls back when a provider returns no structured text", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          model: "test/primary",
          choices: [
            {
              finish_reason: "content_filter",
              message: { content: null, refusal: "Request refused" },
            },
          ],
          usage: {
            prompt_tokens: 8,
            completion_tokens: 0,
            total_tokens: 8,
            cost: null,
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          model: "test/fallback",
          choices: [{ message: { content: JSON.stringify({ answer: "ok" }) } }],
          usage: {
            prompt_tokens: 8,
            completion_tokens: 4,
            total_tokens: 12,
            cost: 0.00001,
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStructured({
      model: "test/primary",
      fallbackModel: "test/fallback",
      system: "Return the schema.",
      payload: { company: "Muster GmbH" },
      schema: z.object({ answer: z.string() }),
      schemaName: "test_answer",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.model).toBe("test/fallback");
    expect(result.output).toEqual({ answer: "ok" });
  });

  it.each([
    {
      model: "z-ai/glm-5.3-flash",
      response: {
        choices: [{ message: { content: JSON.stringify({ answer: "glm" }) } }],
        usage: null,
      },
      answer: "glm",
      costMicros: null,
    },
    {
      model: "google/gemini-3-flash-preview",
      response: {
        model: "google/gemini-3-flash-preview",
        choices: [
          {
            message: {
              content: [
                { type: "text", text: '{"answer":' },
                { type: "text", text: '"gemini"}' },
              ],
            },
          },
        ],
        usage: { cost: "0.000002" },
      },
      answer: "gemini",
      costMicros: 2,
    },
    {
      model: "openai/gpt-5.4-mini",
      response: {
        model: "openai/gpt-5.4-mini",
        choices: [{ message: { content: { answer: "openai" } } }],
        usage: { prompt_tokens: 10, completion_tokens: 3, cost: null },
      },
      answer: "openai",
      costMicros: null,
    },
    {
      model: "anthropic/claude-sonnet-4.6",
      response: {
        model: "anthropic/claude-sonnet-4.6",
        choices: [
          { message: { content: '```json\n{"answer":"claude"}\n```' } },
        ],
        usage: { cost: 0.000003 },
      },
      answer: "claude",
      costMicros: 3,
    },
  ])(
    "normalizes structured responses from $model",
    async ({ model, response, answer, costMicros }) => {
      vi.stubEnv("OPENROUTER_API_KEY", "test-key");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(Response.json(response)),
      );

      const result = await generateStructured({
        model,
        system: "Return the schema.",
        payload: { company: "Muster GmbH" },
        schema: z.object({ answer: z.string() }),
        schemaName: "model_matrix_answer",
      });

      expect(result.model).toBe(model);
      expect(result.output).toEqual({ answer });
      expect(result.estimatedCostMicros).toBe(costMicros);
    },
  );

  it("falls back from a successful HTTP response containing an API error", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: { code: "provider_error", message: "failed" } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          model: "test/fallback",
          choices: [
            { message: { content: JSON.stringify({ answer: "recovered" }) } },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStructured({
      model: "test/primary",
      fallbackModel: "test/fallback",
      system: "Return the schema.",
      payload: {},
      schema: z.object({ answer: z.string() }),
      schemaName: "fallback_answer",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      model: "test/fallback",
      output: { answer: "recovered" },
    });
  });
});
