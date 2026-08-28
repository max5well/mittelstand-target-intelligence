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

import { DELETE, PATCH } from "@/app/api/companies/[id]/route";

const companyId = "00000000-0000-4000-8000-000000000020";
const workspaceId = "00000000-0000-4000-8000-000000000010";
const userId = "00000000-0000-4000-8000-000000000001";

function createRequest(
  method: "PATCH" | "DELETE",
  body?: Record<string, unknown>,
) {
  return new Request(`http://localhost/api/companies/${companyId}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-workspace-id": workspaceId,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function createSupabaseMock({
  currentStatus = "shortlisted",
  previousStatus = "shortlisted",
  companyExists = true,
}: {
  currentStatus?: string;
  previousStatus?: string | null;
  companyExists?: boolean;
} = {}) {
  const updateBuilder = {
    error: null,
    eq: vi.fn(),
  };
  updateBuilder.eq.mockReturnValue(updateBuilder);

  const deleteBuilder = {
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(async () => ({
      data: companyExists ? { id: companyId } : null,
      error: null,
    })),
  };
  deleteBuilder.eq.mockReturnValue(deleteBuilder);
  deleteBuilder.select.mockReturnValue(deleteBuilder);

  const companyBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({
      data: companyExists ? { id: companyId, status: currentStatus } : null,
      error: null,
    })),
    update: vi.fn(() => updateBuilder),
    delete: vi.fn(() => deleteBuilder),
  };
  companyBuilder.select.mockReturnValue(companyBuilder);
  companyBuilder.eq.mockReturnValue(companyBuilder);

  const pipelineBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(async () => ({
      data: previousStatus ? { from_status: previousStatus } : null,
      error: null,
    })),
    insert: vi.fn(async () => ({ error: null })),
  };
  pipelineBuilder.select.mockReturnValue(pipelineBuilder);
  pipelineBuilder.eq.mockReturnValue(pipelineBuilder);
  pipelineBuilder.order.mockReturnValue(pipelineBuilder);
  pipelineBuilder.limit.mockReturnValue(pipelineBuilder);

  const enrichmentJobsBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    then: vi.fn((resolve) => resolve({ data: [{ id: "job-1" }], error: null })),
  };
  enrichmentJobsBuilder.select.mockReturnValue(enrichmentJobsBuilder);
  enrichmentJobsBuilder.eq.mockReturnValue(enrichmentJobsBuilder);

  const usageBuilder = {
    error: null,
    update: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
  };
  usageBuilder.update.mockReturnValue(usageBuilder);
  usageBuilder.eq.mockReturnValue(usageBuilder);
  usageBuilder.in.mockReturnValue(usageBuilder);

  const from = vi.fn((table: string) => {
    if (table === "companies") return companyBuilder;
    if (table === "enrichment_jobs") return enrichmentJobsBuilder;
    if (table === "provider_usage_events") return usageBuilder;
    return pipelineBuilder;
  });

  return {
    from,
    companyBuilder,
    updateBuilder,
    deleteBuilder,
    pipelineBuilder,
    enrichmentJobsBuilder,
    usageBuilder,
  };
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
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVER_ACCESS_TOKEN;
});

describe("company lifecycle route", () => {
  it("archives a company and records its previous pipeline status", async () => {
    const supabase = createSupabaseMock({ currentStatus: "shortlisted" });
    mocks.createAdminClient.mockReturnValue(supabase);

    const response = await PATCH(createRequest("PATCH", { archived: true }), {
      params: Promise.resolve({ id: companyId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "archived" });
    expect(supabase.companyBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "archived" }),
    );
    expect(supabase.pipelineBuilder.insert).toHaveBeenCalledWith({
      workspace_id: workspaceId,
      company_id: companyId,
      from_status: "shortlisted",
      to_status: "archived",
      changed_by: userId,
    });
  });

  it("restores the pipeline status that preceded archiving", async () => {
    const supabase = createSupabaseMock({
      currentStatus: "archived",
      previousStatus: "in_conversation",
    });
    mocks.createAdminClient.mockReturnValue(supabase);

    const response = await PATCH(createRequest("PATCH", { archived: false }), {
      params: Promise.resolve({ id: companyId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "in_conversation",
    });
    expect(supabase.companyBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "in_conversation" }),
    );
  });

  it("permanently deletes only the workspace-scoped company", async () => {
    const supabase = createSupabaseMock();
    mocks.createAdminClient.mockReturnValue(supabase);

    const response = await DELETE(createRequest("DELETE"), {
      params: Promise.resolve({ id: companyId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true });
    expect(supabase.deleteBuilder.eq.mock.calls).toEqual([
      ["workspace_id", workspaceId],
      ["id", companyId],
    ]);
    expect(supabase.usageBuilder.update).toHaveBeenCalledWith({
      enrichment_job_id: null,
    });
    expect(supabase.usageBuilder.in).toHaveBeenCalledWith("enrichment_job_id", [
      "job-1",
    ]);
  });

  it("does not mutate a company outside the authorized workspace", async () => {
    const supabase = createSupabaseMock({ companyExists: false });
    mocks.createAdminClient.mockReturnValue(supabase);

    const response = await DELETE(createRequest("DELETE"), {
      params: Promise.resolve({ id: companyId }),
    });

    expect(response.status).toBe(404);
    expect(supabase.companyBuilder.delete).not.toHaveBeenCalled();
  });
});
