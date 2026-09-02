import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  creditsForProviderOutcome,
  fetchProvider,
  PROVIDER_REQUEST_TIMEOUT_MS,
  ProviderError,
} from "@/lib/integrations/http";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("provider HTTP errors", () => {
  it("identifies the provider and explains HTTP 402", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("Payment required", { status: 402 })),
    );

    await expect(
      fetchProvider(
        "https://api.openregister.de/v1/company/example",
        {},
        z.object({ ok: z.boolean() }),
      ),
    ).rejects.toMatchObject({
      status: 402,
      message:
        "Provider request to api.openregister.de failed with status 402. The provider account has no usable credits or billing access.",
    });
  });

  it("attaches the configured abort budget to every provider request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchProvider(
      "https://api.example.com/hung",
      {},
      z.object({ ok: z.boolean() }),
      1,
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(PROVIDER_REQUEST_TIMEOUT_MS).toBe(15_000);
  });

  it("logs safe schema issue paths without logging provider payload values", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ secret: "do-not-log" })),
    );

    await expect(
      fetchProvider(
        "https://api.example.com/result",
        {},
        z.object({ ok: z.boolean() }),
        1,
      ),
    ).rejects.toBeInstanceOf(ProviderError);

    expect(errorSpy).toHaveBeenCalledWith(
      "Provider response schema mismatch",
      expect.objectContaining({
        host: "api.example.com",
        status: 200,
        issues: [expect.objectContaining({ path: "ok" })],
      }),
    );
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("do-not-log");
    errorSpy.mockRestore();
  });

  it("accepts a JSON response accidentally framed as a single SSE event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('data: {"ok":true}\n\ndata: [DONE]\n', {
          headers: { "content-type": "text/event-stream" },
        }),
      ),
    );

    await expect(
      fetchProvider(
        "https://api.example.com/result",
        {},
        z.object({ ok: z.boolean() }),
        1,
      ),
    ).resolves.toEqual({ ok: true });
  });
});

describe("provider credit attribution", () => {
  it.each([
    [402, 0],
    [404, 10],
    [429, 0],
    [500, 0],
  ])("maps HTTP %i to %i credits", (status, expected) => {
    expect(
      creditsForProviderOutcome(
        10,
        new ProviderError("provider failure", status),
      ),
    ).toBe(expected);
  });

  it("never multiplies a non-2xx charge by the retry count", () => {
    expect(
      creditsForProviderOutcome(
        10,
        new ProviderError("not found", 404, undefined, 3),
        3,
      ),
    ).toBe(10);
  });

  it("does not bill transport failures", () => {
    expect(creditsForProviderOutcome(10, new TypeError("fetch failed"))).toBe(
      0,
    );
  });
});
