import { afterEach, describe, expect, it, vi } from "vitest";
import { getIntegrationStatuses } from "@/lib/integrations/status";

afterEach(() => vi.unstubAllEnvs());

describe("integration availability", () => {
  it("keeps provider-backed screens usable in mock mode", () => {
    vi.stubEnv("MOCK_PROVIDERS", "true");

    expect(getIntegrationStatuses().every((provider) => provider.usable)).toBe(
      true,
    );
  });

  it("requires provider and database credentials in live mode", () => {
    vi.stubEnv("MOCK_PROVIDERS", "false");
    vi.stubEnv("OPENREGISTER_API_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    expect(
      getIntegrationStatuses().find(
        (provider) => provider.id === "openregister",
      )?.usable,
    ).toBe(false);
  });
});
