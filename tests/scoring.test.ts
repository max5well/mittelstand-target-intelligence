import { describe, expect, it } from "vitest";
import { calculateScore, defaultWeights } from "@/lib/scoring";

describe("investment-fit scoring", () => {
  it("uses transparent weights totaling 100", () =>
    expect(
      Object.values(defaultWeights).reduce((sum, value) => sum + value, 0),
    ).toBe(100));
  it("returns insufficient data when required reported facts are null", () =>
    expect(
      calculateScore({
        revenueCents: null,
        ebitdaCents: 100,
        employees: 100,
        ownershipFit: 1,
        successionSignal: true,
        industryFit: 1,
        dataAgeDays: 30,
      }).insufficientData,
    ).toBe(true));
  it("calculates a strong target without treating cents as euros", () => {
    const result = calculateScore({
      revenueCents: 5_000_000_000,
      ebitdaCents: 800_000_000,
      employees: 180,
      ownershipFit: 1,
      successionSignal: true,
      industryFit: 0.9,
      dataAgeDays: 30,
    });
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.components).toHaveProperty("financial");
  });
});
