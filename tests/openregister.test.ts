import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CompanySearchRequestSchema,
  OpenRegisterProvider,
} from "@/lib/integrations/openregister";

describe("OpenRegister adapter", () => {
  afterEach(() => {
    delete process.env.MOCK_PROVIDERS;
    delete process.env.OPENREGISTER_API_KEY;
    vi.unstubAllGlobals();
  });
  it("validates AND-style documented filters and pagination", () => {
    const request = CompanySearchRequestSchema.parse({
      filters: [
        { field: "active", value: "true" },
        { field: "revenue", min: "1000000000" },
        { field: "industry_codes", values: ["28", "26"] },
        { field: "has_open_insolvency", value: "false" },
      ],
      pagination: { page: 1, per_page: 40 },
    });
    expect(request.filters).toHaveLength(4);
    expect(request.pagination.per_page).toBe(40);
  });
  it("rejects filters without a documented value shape", () => {
    expect(() =>
      CompanySearchRequestSchema.parse({
        filters: [{ field: "revenue" }],
        pagination: { page: 1, per_page: 40 },
      }),
    ).toThrow();
  });
  it("deduplicates around stable OpenRegister IDs in mock search results", async () => {
    process.env.MOCK_PROVIDERS = "true";
    const response = await new OpenRegisterProvider().search({
      filters: [],
      pagination: { page: 1, per_page: 40 },
    });
    expect(response.results).toHaveLength(40);
    expect(new Set(response.results.map((item) => item.company_id)).size).toBe(
      40,
    );
  });

  it("requests best-available ownership data", async () => {
    process.env.MOCK_PROVIDERS = "false";
    process.env.OPENREGISTER_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ owners: [], best_available: true }));
    vi.stubGlobal("fetch", fetchMock);
    await new OpenRegisterProvider().owners("company-1");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/owners?best_available=true",
    );
    vi.unstubAllGlobals();
  });
});
