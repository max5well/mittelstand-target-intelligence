import { describe, expect, it } from "vitest";
import { isOpenRegisterId } from "@/lib/openregister-id";

describe("OpenRegister company IDs", () => {
  it.each(["manual:123", "concess:D123", "", "   ", null, undefined])(
    "rejects pseudo or absent ID %s",
    (value) => expect(isOpenRegisterId(value)).toBe(false),
  );

  it("accepts a provider-issued company ID", () => {
    expect(isOpenRegisterId("de-hrb-K1101-12345")).toBe(true);
  });
});
