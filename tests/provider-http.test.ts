import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchProvider } from "@/lib/integrations/http";

afterEach(() => vi.unstubAllGlobals());

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
});
