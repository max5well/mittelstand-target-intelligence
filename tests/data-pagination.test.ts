import { describe, expect, it, vi } from "vitest";
import { fetchAllRows } from "@/lib/data/companies";

describe("database result pagination", () => {
  it("does not silently truncate beyond PostgREST's 1,000-row limit", async () => {
    const source = Array.from({ length: 1_200 }, (_, id) => ({ id }));
    const query = vi.fn(async (from: number, to: number) => ({
      data: source.slice(from, to + 1),
      error: null,
    }));

    const rows = await fetchAllRows(query, "test rows");
    expect(rows).toHaveLength(1_200);
    expect(query).toHaveBeenCalledTimes(3);
  });
});
