import { describe, expect, it } from "vitest";
import { getMarkerPresentation } from "@/lib/map-visualization";

describe("map visualization modes", () => {
  it("uses the dominant ownership group instead of the highest-scored company", () => {
    const result = getMarkerPresentation(
      [
        {
          status: "new",
          ownership: "PE-backed or financial-sponsor-owned",
          score: 95,
        },
        { status: "new", ownership: "Family-owned", score: 70 },
        { status: "reviewed", ownership: "Owner-managed", score: 68 },
      ],
      "ownership",
    );

    expect(result.label).toBe("Inhaber / Familie");
    expect(result.color).toBe("#1f9d7a");
  });

  it("uses the average available score for a location", () => {
    const result = getMarkerPresentation(
      [
        { status: "new", ownership: "Unknown", score: 90 },
        { status: "new", ownership: "Unknown", score: 60 },
        { status: "new", ownership: "Unknown", score: null },
      ],
      "score",
    );

    expect(result.label).toBe("65–79");
    expect(result.detail).toBe("Ø 75");
  });

  it("distinguishes active pipeline locations from early-stage locations", () => {
    const result = getMarkerPresentation(
      [
        { status: "contacted", ownership: "Unknown", score: null },
        { status: "in_conversation", ownership: "Unknown", score: null },
        { status: "new", ownership: "Unknown", score: null },
      ],
      "status",
    );

    expect(result.label).toBe("Aktiver Prozess");
  });
});
