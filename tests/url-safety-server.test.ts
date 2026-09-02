import { describe, expect, it, vi } from "vitest";
import { resolvePublicHttpUrl } from "@/lib/url-safety-server";

describe("public website DNS validation", () => {
  it("accepts a hostname only when every returned address is public", async () => {
    const resolve = vi.fn().mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ]);
    await expect(
      resolvePublicHttpUrl("https://example.com", resolve),
    ).resolves.toBe("https://example.com");
  });

  it("rejects a hostname if DNS returns a private address", async () => {
    const resolve = vi.fn().mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ]);
    await expect(
      resolvePublicHttpUrl("https://example.com", resolve),
    ).rejects.toThrow("non-public network address");
  });
});
