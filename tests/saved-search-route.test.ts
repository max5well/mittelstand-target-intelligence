import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeWorkspaceRequest: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
  authorizeWorkspaceRequest: mocks.authorizeWorkspaceRequest,
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { DELETE } from "@/app/api/searches/[id]/route";

const searchId = "00000000-0000-4000-8000-000000000040";
const workspaceId = "00000000-0000-4000-8000-000000000010";

function createRequest(id = searchId) {
  return new Request(`http://localhost/api/searches/${id}`, {
    method: "DELETE",
    headers: { "x-workspace-id": workspaceId },
  });
}

function queryResult<T>(data: T) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    then: vi.fn((resolve: (result: { data: T; error: null }) => unknown) =>
      resolve({ data, error: null }),
    ),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  return builder;
}

function createSupabaseMock({ searchExists = true } = {}) {
  const runsBuilder = queryResult(searchExists ? [{ id: "run-1" }] : []);
  const jobsBuilder = queryResult([{ id: "job-1" }]);

  const usageBuilder = {
    update: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(async () => ({ data: null, error: null })),
  };
  usageBuilder.update.mockReturnValue(usageBuilder);
  usageBuilder.eq.mockReturnValue(usageBuilder);

  const deleteBuilder = {
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(async () => ({
      data: searchExists ? { id: searchId } : null,
      error: null,
    })),
  };
  deleteBuilder.eq.mockReturnValue(deleteBuilder);
  deleteBuilder.select.mockReturnValue(deleteBuilder);
  const searchesBuilder = { delete: vi.fn(() => deleteBuilder) };

  const from = vi.fn((table: string) => {
    if (table === "search_runs") return runsBuilder;
    if (table === "enrichment_jobs") return jobsBuilder;
    if (table === "provider_usage_events") return usageBuilder;
    return searchesBuilder;
  });

  return {
    from,
    runsBuilder,
    jobsBuilder,
    usageBuilder,
    deleteBuilder,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVER_ACCESS_TOKEN = "test-token";
  mocks.authorizeWorkspaceRequest.mockResolvedValue({
    ok: true,
    workspaceId,
    userId: "00000000-0000-4000-8000-000000000001",
    role: "admin",
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVER_ACCESS_TOKEN;
});

describe("saved search route", () => {
  it("deletes only the workspace-scoped search and preserves usage history", async () => {
    const supabase = createSupabaseMock();
    mocks.createAdminClient.mockReturnValue(supabase);
    const request = createRequest();

    const response = await DELETE(request, {
      params: Promise.resolve({ id: searchId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true });
    expect(mocks.authorizeWorkspaceRequest).toHaveBeenCalledWith(request, {
      write: true,
    });
    expect(supabase.runsBuilder.eq.mock.calls).toEqual([
      ["workspace_id", workspaceId],
      ["saved_search_id", searchId],
    ]);
    expect(supabase.usageBuilder.update).toHaveBeenCalledWith({
      enrichment_job_id: null,
    });
    expect(supabase.usageBuilder.in).toHaveBeenCalledWith("enrichment_job_id", [
      "job-1",
    ]);
    expect(supabase.deleteBuilder.eq.mock.calls).toEqual([
      ["workspace_id", workspaceId],
      ["id", searchId],
    ]);
  });

  it("returns not found when the search is outside the workspace", async () => {
    const supabase = createSupabaseMock({ searchExists: false });
    mocks.createAdminClient.mockReturnValue(supabase);

    const response = await DELETE(createRequest(), {
      params: Promise.resolve({ id: searchId }),
    });

    expect(response.status).toBe(404);
  });

  it("rejects an invalid search id before touching the database", async () => {
    const request = createRequest("not-a-uuid");
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
