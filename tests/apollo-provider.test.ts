import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApolloOrganizationSchema,
  ApolloProvider,
} from "@/lib/integrations/apollo";
import { ProviderError } from "@/lib/integrations/http";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Apollo organization enrichment", () => {
  it("normalizes a successful response with no organization to a no-match", async () => {
    vi.stubEnv("MOCK_PROVIDERS", "false");
    vi.stubEnv("APOLLO_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));

    const result = await new ApolloProvider().enrichOrganization({
      domain: "not-listed.example",
    });

    expect(result.organization).toBeNull();
  });

  it("continues to accept Apollo's explicit null no-match response", () => {
    expect(
      ApolloOrganizationSchema.parse({ organization: null }).organization,
    ).toBeNull();
  });

  it("does not hide unexpected non-object organization payloads", async () => {
    vi.stubEnv("MOCK_PROVIDERS", "false");
    vi.stubEnv("APOLLO_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ organization: [] })),
    );

    await expect(
      new ApolloProvider().enrichOrganization({ domain: "example.com" }),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});
