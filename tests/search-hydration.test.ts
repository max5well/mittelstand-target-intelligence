import { describe, expect, it } from "vitest";
import { shouldAutoDiscoverWebsites } from "@/lib/discovery/run-saved-search";

describe("saved-search website hydration", () => {
  const search = {
    id: "search-1",
    workspace_id: "workspace-1",
    filters: [],
    daily_target: 10,
  };

  it("adds website discovery to existing lean and full searches", () => {
    expect(
      shouldAutoDiscoverWebsites({ ...search, hydration_mode: "lean" }),
    ).toBe(true);
    expect(
      shouldAutoDiscoverWebsites({ ...search, hydration_mode: "full" }),
    ).toBe(true);
  });

  it("respects an explicit custom website-discovery stage", () => {
    expect(
      shouldAutoDiscoverWebsites({
        ...search,
        hydration_mode: "custom",
        hydration_stages: ["website_discovery"],
      }),
    ).toBe(true);
    expect(
      shouldAutoDiscoverWebsites({
        ...search,
        hydration_mode: "custom",
        hydration_stages: [],
      }),
    ).toBe(false);
  });
});
