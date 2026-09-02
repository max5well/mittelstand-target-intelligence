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
        usage: { total_tokens: 12 },
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
      store: false,
    });
  });
});
