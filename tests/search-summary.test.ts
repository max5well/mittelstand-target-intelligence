import { describe, expect, it } from "vitest";
import { matchesSelectedLegalForm } from "@/lib/discovery/search-filters";
import { describeSavedSearch } from "@/lib/search-summary";

describe("saved search summary", () => {
  it("describes a search without predefined filters neutrally", () => {
    expect(
      describeSavedSearch({ filters: [], industryNames: [], states: [] }),
    ).toBe("Deutschlandweite Suche ohne zusätzliche Filter.");
  });

  it("summarizes the filters selected by the user", () => {
    const summary = describeSavedSearch({
      filters: [
        { field: "status", value: "active" },
        { field: "legal_form", values: ["gmbh", "kg"] },
        { field: "revenue", min: "1000000000", max: "5000000000" },
        { field: "has_open_insolvency", value: "false" },
      ],
      industryNames: ["Maschinenbau"],
      states: ["Bayern"],
    });

    expect(summary).toContain("Nur aktive Unternehmen");
    expect(summary).toContain("Branchen: Maschinenbau");
    expect(summary).toContain("Regionen: Bayern");
    expect(summary).toContain("Rechtsformen: GMBH, GmbH & Co. KG/KG");
    expect(summary).toContain("Umsatz: 10.000.000 €–50.000.000 €");
    expect(summary).toContain("laufende Insolvenzen ausgeschlossen");
  });

  it("keeps GmbHs and only GmbH & Co. KGs from the broader KG register type", () => {
    const selected = ["gmbh", "kg"];
    expect(
      matchesSelectedLegalForm(
        { name: "Muster GmbH", legal_form: "gmbh" },
        selected,
      ),
    ).toBe(true);
    expect(
      matchesSelectedLegalForm(
        { name: "Muster GmbH & Co. KG", legal_form: "kg" },
        selected,
      ),
    ).toBe(true);
    expect(
      matchesSelectedLegalForm(
        { name: "Muster Kommanditgesellschaft", legal_form: "kg" },
        selected,
      ),
    ).toBe(false);
  });
});
