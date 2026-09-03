import { describe, expect, it } from "vitest";
import {
  SafePublicHttpUrlSchema,
  isPublicHttpUrl,
  isSameWebsiteUrl,
} from "@/lib/url-safety";

describe("public website URL validation", () => {
  it.each([
    "file:///etc/passwd",
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.1",
    "http://192.168.1.1",
    "http://100.64.0.1",
    "http://100.127.255.254",
    "http://[::1]",
    "http://[::ffff:127.0.0.1]",
    "http://[::ffff:10.0.0.1]",
    "http://[::ffff:7f00:1]",
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

describe("website identity", () => {
  it("treats www and subdomains as the same first-party website", () => {
    expect(
      isSameWebsiteUrl(
        "https://news.kelvion.com/article",
        "https://www.kelvion.com",
      ),
    ).toBe(true);
  });

  it("keeps independent domains distinct", () => {
    expect(
      isSameWebsiteUrl(
        "https://www.handelsblatt.com/unternehmen/kelvion",
        "https://kelvion.com",
      ),
    ).toBe(false);
  });
});
