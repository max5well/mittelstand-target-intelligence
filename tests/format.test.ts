import { describe, expect, it } from "vitest";
import { formatMoney, formatPercent } from "@/lib/format";

describe("formatMoney", () => {
  it("uses deterministic compact units across server and browser runtimes", () => {
    expect(formatMoney(2_100_000_000)).toBe("21 Mio. €");
    expect(formatMoney(475_000_000)).toBe("4,8 Mio. €");
    expect(formatMoney(125_000)).toBe("1,3 Tsd. €");
  });
});

describe("formatPercent", () => {
  it("renders OpenRegister ownership fractions as percentages", () => {
    expect(formatPercent(0.5)).toBe("50 %");
    expect(formatPercent(1)).toBe("100 %");
  });
});
