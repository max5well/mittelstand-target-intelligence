import { describe, expect, it } from "vitest";
import {
  jobIdempotencyKey,
  nextAttempt,
  searchRunKey,
} from "@/lib/jobs/backoff";

describe("job reliability", () => {
  it("creates stable scheduled run keys", () =>
    expect(searchRunKey("search-1", "2026-08-27")).toBe("search-1:2026-08-27"));
  it("creates stable provider idempotency keys", () =>
    expect(
      jobIdempotencyKey({
        workspaceId: "w1",
        companyId: "c1",
        type: "owners",
        freshnessBucket: "2026-W35",
      }),
    ).toBe("w1:c1:owners:2026-W35"));
  it("backs off exponentially with bounded jitter", () => {
    const now = 1_000_000;
    expect(nextAttempt(3, now, 0).getTime()).toBe(now + 4_000);
    expect(nextAttempt(3, now, 1).getTime()).toBeLessThanOrEqual(now + 5_000);
  });
});
