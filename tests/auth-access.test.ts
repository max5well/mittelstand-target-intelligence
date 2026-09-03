import { describe, expect, it } from "vitest";
import {
  ALLOWED_EMAILS,
  EVAL_ADMIN_EMAIL,
  isAllowedEmail,
  isAllowedGoogleUser,
  isEvalAdminEmail,
} from "@/lib/auth/access";

describe("production account allowlist", () => {
  it("contains exactly the approved email addresses", () => {
    expect(ALLOWED_EMAILS).toEqual([
      "wiese@dge.technology",
      "leonhardt@dge.technology",
    ]);
  });

  it("normalizes email casing and surrounding whitespace", () => {
    expect(isAllowedEmail(" WIESE@DGE.TECHNOLOGY ")).toBe(true);
    expect(isAllowedEmail("someone@dge.technology")).toBe(false);
  });

  it("requires Google as the authenticated provider", () => {
    expect(
      isAllowedGoogleUser({
        email: "leonhardt@dge.technology",
        app_metadata: { provider: "google" },
      }),
    ).toBe(true);
    expect(
      isAllowedGoogleUser({
        email: "leonhardt@dge.technology",
        app_metadata: { provider: "email" },
      }),
    ).toBe(false);
  });

  it("limits the Eval Console to the designated owner", () => {
    expect(EVAL_ADMIN_EMAIL).toBe("wiese@dge.technology");
    expect(isEvalAdminEmail(" WIESE@DGE.TECHNOLOGY ")).toBe(true);
    expect(isEvalAdminEmail("leonhardt@dge.technology")).toBe(false);
  });
});
