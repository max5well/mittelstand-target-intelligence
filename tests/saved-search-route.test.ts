import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeWorkspaceRequest: vi.fn(),
  createAdminClient: vi.fn(),
  runSavedSearch: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
  authorizeWorkspaceRequest: mocks.authorizeWorkspaceRequest,
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/discovery/run-saved-search", () => ({
  runSavedSearch: mocks.runSavedSearch,
}));

import { POST } from "@/app/api/searches/route";

const workspaceId = "00000000-0000-4000-8000-000000000010";

beforeEach(() => {
  mocks.authorizeWorkspaceRequest.mockResolvedValue({
    ok: true,
    workspaceId,
    userId: "00000000-0000-4000-8000-000000000001",
    role: "admin",
  });
});

describe("saved search route", () => {
  it("persists a new search without predefined filters", async () => {
    const single = vi.fn(async () => ({
      data: {
        id: "search-1",
        workspace_id: workspaceId,
        filters: [],
        daily_target: 10,
        hydration_mode: "full",
        hydration_stages: [
          "details",
          "financials",
          "owners",
          "website_discovery",
        ],
      },
      error: null,
    }));
    const builder = {
      insert: vi.fn(),
      select: vi.fn(),
      single,
    };
    builder.insert.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => builder),
    });

    const response = await POST(
      new Request("http://localhost/api/searches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId,
        },
        body: JSON.stringify({
          name: "Eigene Zielgruppe",
          description: "",
          summary: "Deutschlandweite Suche ohne zusätzliche Filter.",
          filters: [],
          hydrationMode: "full",
          dailyTarget: 10,
          active: false,
          runNow: false,
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      searchId: "search-1",
      run: null,
    });
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: workspaceId,
        name: "Eigene Zielgruppe",
        filters: [],
      }),
    );
  });
});
