import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeWorkspaceRequest: vi.fn(),
  deleteCopilotRun: vi.fn(),
  getCopilotRun: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
  authorizeWorkspaceRequest: mocks.authorizeWorkspaceRequest,
}));
vi.mock("@/lib/data/copilot", () => ({
  deleteCopilotRun: mocks.deleteCopilotRun,
  getCopilotRun: mocks.getCopilotRun,
}));

import { DELETE } from "@/app/api/copilot/runs/[id]/route";

const runId = "00000000-0000-4000-8000-000000000030";
const workspaceId = "00000000-0000-4000-8000-000000000010";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorizeWorkspaceRequest.mockResolvedValue({
    ok: true,
    workspaceId,
    userId: "00000000-0000-4000-8000-000000000001",
    role: "admin",
  });
  mocks.deleteCopilotRun.mockResolvedValue(true);
});

afterEach(() => vi.restoreAllMocks());

describe("Copilot run route", () => {
  it("deletes a completed run within the authorized workspace", async () => {
    const request = new Request(`http://localhost/api/copilot/runs/${runId}`, {
      method: "DELETE",
      headers: { "x-workspace-id": workspaceId },
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: runId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true });
    expect(mocks.authorizeWorkspaceRequest).toHaveBeenCalledWith(request, {
      write: true,
    });
    expect(mocks.deleteCopilotRun).toHaveBeenCalledWith(workspaceId, runId);
  });

  it("rejects an invalid run id without deleting anything", async () => {
    const request = new Request(
      "http://localhost/api/copilot/runs/not-a-uuid",
      {
        method: "DELETE",
        headers: { "x-workspace-id": workspaceId },
      },
    );
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.deleteCopilotRun).not.toHaveBeenCalled();
  });
});
