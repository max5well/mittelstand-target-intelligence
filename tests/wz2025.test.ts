import { describe, expect, it } from "vitest";
import { getWz2025IndustryName, wz2025Industries } from "@/lib/wz2025";

describe("WZ 2025 labels", () => {
  it("maps source codes to readable names", () => {
    expect(getWz2025IndustryName("86.22")).toBe(
      "Medical specialists activities",
    );
    expect(getWz2025IndustryName("26.40")).toBe(
      "Manufacture of consumer electronics",
    );
  });

  it("offers the complete class list for the name selector", () => {
    expect(wz2025Industries).toHaveLength(651);
  });
});
