import { afterEach, describe, expect, it, vi } from "vitest";
import { getOwnerPreviewIdentity } from "@/lib/auth/preview";

const originalPreviewMode = process.env.OWNER_ONLY_PREVIEW_MODE;
afterEach(() => {
  if (originalPreviewMode === undefined) {
    delete process.env.OWNER_ONLY_PREVIEW_MODE;
  } else {
    process.env.OWNER_ONLY_PREVIEW_MODE = originalPreviewMode;
  }
  vi.unstubAllEnvs();
});

describe("owner-only preview authentication", () => {
  it("rejects hosting identity headers unless preview mode is explicit", () => {
    delete process.env.OWNER_ONLY_PREVIEW_MODE;
    const requestHeaders = new Headers({
      "oai-authenticated-user-id": "owner-1",
      "oai-authenticated-user-email": "owner@example.com",
    });

    expect(getOwnerPreviewIdentity(requestHeaders)).toBeNull();
  });

  it("rejects preview mode without both authenticated hosting headers", () => {
    process.env.OWNER_ONLY_PREVIEW_MODE = "true";

    expect(getOwnerPreviewIdentity(new Headers())).toBeNull();
    expect(
      getOwnerPreviewIdentity(
        new Headers({ "oai-authenticated-user-id": "owner-1" }),
      ),
    ).toBeNull();
  });

  it("accepts the externally authenticated owner in preview mode", () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.OWNER_ONLY_PREVIEW_MODE = "true";
    const requestHeaders = new Headers({
      "oai-authenticated-user-id": " owner-1 ",
      "oai-authenticated-user-email": " owner@example.com ",
    });

    expect(getOwnerPreviewIdentity(requestHeaders)).toEqual({
      id: "owner-1",
      email: "owner@example.com",
    });
  });

  it("always rejects preview headers in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.OWNER_ONLY_PREVIEW_MODE = "true";
    expect(
      getOwnerPreviewIdentity(
        new Headers({
          "oai-authenticated-user-id": "attacker",
          "oai-authenticated-user-email": "attacker@example.com",
        }),
      ),
    ).toBeNull();
  });
});
