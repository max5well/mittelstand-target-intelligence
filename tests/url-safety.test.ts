import { describe, expect, it } from "vitest";
import { SafePublicHttpUrlSchema, isPublicHttpUrl } from "@/lib/url-safety";

describe("public website URL validation", () => {
  it.each([
    "file:///etc/passwd",
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.1",
    "http://192.168.1.1",
    "http://[::1]",
  ])("rejects non-public target %s", (value) => {
    expect(isPublicHttpUrl(value)).toBe(false);
    expect(SafePublicHttpUrlSchema.safeParse(value).success).toBe(false);
  });

  it("accepts a public HTTPS company URL", () => {
    expect(SafePublicHttpUrlSchema.parse("https://example.de/impressum")).toBe(
      "https://example.de/impressum",
    );
  });

  it("does not confuse a public hostname with a private IPv6 prefix", () => {
    expect(isPublicHttpUrl("https://fca.de")).toBe(true);
  });
});
