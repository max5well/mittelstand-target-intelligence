import { describe, expect, it } from "vitest";
import {
  formatGermanRegisterCourt,
  formatGermanRegisterReference,
} from "@/lib/register";

describe("German register formatting", () => {
  it("formats an HRB number without exposing the OpenRegister identifier", () => {
    expect(
      formatGermanRegisterReference({
        registerType: "HRB",
        registerNumber: "37160",
        openregisterCompanyId: "DE-HRB-R1608-37160",
      }),
    ).toBe("HRB37160");
  });

  it("falls back to the OpenRegister identifier when normalized fields are missing", () => {
    expect(
      formatGermanRegisterReference({
        openregisterCompanyId: "DE-HRB-R1608-37160",
      }),
    ).toBe("HRB37160");
  });

  it("prefixes the responsible register court once", () => {
    expect(formatGermanRegisterCourt("Wuppertal")).toBe(
      "Amtsgericht Wuppertal",
    );
    expect(formatGermanRegisterCourt("Amtsgericht Wuppertal")).toBe(
      "Amtsgericht Wuppertal",
    );
  });
});
