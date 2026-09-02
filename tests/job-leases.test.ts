import { describe, expect, it, vi } from "vitest";
import {
  isExpiredLease,
  recoverConflictingJobLease,
} from "@/lib/enrichment/job-leases";

describe("provider job leases", () => {
  const now = Date.parse("2026-09-02T18:00:00.000Z");

  it("treats a past lease as recoverable", () => {
    expect(isExpiredLease("2026-09-02T17:59:59.999Z", now)).toBe(true);
  });

  it("keeps a live conflicting job", () => {
    expect(isExpiredLease("2026-09-02T18:00:00.001Z", now)).toBe(false);
  });

  it("fails closed toward recovery for absent or malformed lease values", () => {
    expect(isExpiredLease(null, now)).toBe(true);
    expect(isExpiredLease("not-a-date", now)).toBe(true);
  });

  it("marks an expired conflicting row failed and permits one retry", async () => {
    const readBuilder = fluentBuilder({
      data: {
        id: "stale-job",
        status: "running",
        actual_credits: null,
        completed_at: null,
        payload: {},
        lease_expires_at: "2020-01-01T00:00:00.000Z",
      },
      error: null,
    });
    const updateBuilder = fluentBuilder({
      data: { id: "stale-job" },
      error: null,
    });
    const update = vi.fn(() => updateBuilder);
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(readBuilder)
        .mockReturnValueOnce({ update }),
    };

    await expect(
      recoverConflictingJobLease(supabase as never, {
        workspaceId: "workspace",
        companyId: "company",
        provider: "openregister",
        jobType: "details",
      }),
    ).resolves.toEqual({ retry: true, active: null });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error_details: expect.objectContaining({
          reason: "expired_lease_recovered",
        }),
      }),
    );
  });
});

function fluentBuilder(result: unknown) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  return builder;
}
