import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeWorkspaceRequest: vi.fn(),
  runOpenRegisterEnrichment: vi.fn(),
  runExternalProviderEnrichment: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
  authorizeWorkspaceRequest: mocks.authorizeWorkspaceRequest,
}));
vi.mock("@/lib/enrichment/openregister", () => ({
  openRegisterStages: ["details", "financials", "owners"] as const,
  runOpenRegisterEnrichment: mocks.runOpenRegisterEnrichment,
}));
vi.mock("@/lib/enrichment/external-providers", () => ({
  externalProviderStages: [
    "website_discovery",
    "apollo_organization",
    "firecrawl_website",
    "tavily_research",
  ] as const,
  runExternalProviderEnrichment: mocks.runExternalProviderEnrichment,
}));

import { POST } from "@/app/api/companies/[id]/enrich/route";
import { ProviderError } from "@/lib/integrations/http";

const companyId = "00000000-0000-4000-8000-000000000020";
const workspaceId = "00000000-0000-4000-8000-000000000010";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorizeWorkspaceRequest.mockResolvedValue({
    ok: true,
    workspaceId,
    userId: "00000000-0000-4000-8000-000000000001",
    role: "admin",
  });
  mocks.runOpenRegisterEnrichment.mockResolvedValue({
    skipped: true,
    available: true,
  });
});

describe("company enrichment route", () => {
  it("does not allow the client to force a completed provider action", async () => {
    const request = new Request(
      `http://localhost/api/companies/${companyId}/enrich`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "details", force: true }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: companyId }),
    });

    expect(response.status).toBe(200);
    expect(mocks.runOpenRegisterEnrichment).toHaveBeenCalledWith({
      workspaceId,
      companyId,
      stage: "details",
    });
  });

  it("returns a friendly credit message without provider internals", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.runOpenRegisterEnrichment.mockRejectedValueOnce(
      new ProviderError(
        "Provider request to api.openregister.de failed with status 402.",
        402,
      ),
    );
    const response = await POST(
      new Request(`http://localhost/api/companies/${companyId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "details" }),
      }),
      { params: Promise.resolve({ id: companyId }) },
    );
    const body = (await response.json()) as { error: string; errorId: string };
    expect(response.status).toBe(502);
    expect(body.error).toContain("Provider-Guthaben erschöpft");
    expect(JSON.stringify(body)).not.toContain("api.openregister.de");
    expect(body.errorId).toEqual(expect.any(String));
  });
});
