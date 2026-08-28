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

import { DELETE, PUT } from "@/app/api/companies/[id]/favorite/route";

const companyId = "00000000-0000-4000-8000-000000000020";
const workspaceId = "00000000-0000-4000-8000-000000000010";
const userId = "00000000-0000-4000-8000-000000000001";

function createRequest(method: "PUT" | "DELETE") {
  return new Request(`http://localhost/api/companies/${companyId}/favorite`, {
    method,
    headers: { "x-workspace-id": workspaceId },
  });
}

function createSupabaseMock(companyExists = true) {
  const companyBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({
      data: companyExists ? { id: companyId } : null,
      error: null,
    })),
  };
  companyBuilder.select.mockReturnValue(companyBuilder);
  companyBuilder.eq.mockReturnValue(companyBuilder);

  const deleteBuilder = { eq: vi.fn() };
  deleteBuilder.eq.mockReturnValue(deleteBuilder);
  const upsert = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(() => deleteBuilder);
  const from = vi.fn((table: string) =>
    table === "companies" ? companyBuilder : { upsert, delete: remove },
  );

  return { from, upsert, remove, deleteBuilder };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVER_ACCESS_TOKEN = "test-token";
  mocks.authorizeWorkspaceRequest.mockResolvedValue({
    ok: true,
    workspaceId,
    userId,
    role: "admin",
  });
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVER_ACCESS_TOKEN;
});

describe("company favorite route", () => {
  it("upserts the authorized user's favorite", async () => {
    const supabase = createSupabaseMock();
    mocks.createAdminClient.mockReturnValue(supabase);

    const response = await PUT(createRequest("PUT"), {
      params: Promise.resolve({ id: companyId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ favorite: true });
    expect(supabase.upsert).toHaveBeenCalledWith(
      { workspace_id: workspaceId, company_id: companyId, user_id: userId },
      { onConflict: "company_id,user_id", ignoreDuplicates: true },
    );
  });

  it("scopes removal to workspace, company, and user", async () => {
    const supabase = createSupabaseMock();
    mocks.createAdminClient.mockReturnValue(supabase);

    const response = await DELETE(createRequest("DELETE"), {
      params: Promise.resolve({ id: companyId }),
    });

    expect(response.status).toBe(200);
    expect(supabase.deleteBuilder.eq.mock.calls).toEqual([
      ["workspace_id", workspaceId],
      ["company_id", companyId],
      ["user_id", userId],
    ]);
  });

  it("does not write when the company is outside the workspace", async () => {
    const supabase = createSupabaseMock(false);
    mocks.createAdminClient.mockReturnValue(supabase);

    const response = await PUT(createRequest("PUT"), {
      params: Promise.resolve({ id: companyId }),
    });

    expect(response.status).toBe(404);
    expect(supabase.upsert).not.toHaveBeenCalled();
  });
});
