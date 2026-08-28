import { describe, expect, it } from "vitest";
import {
  acquisitionTargetPreset,
  climateTechnologyPreset,
  describeAcquisitionPreset,
  matchesAcquisitionLegalForm,
  roofingPreset,
} from "@/lib/acquisition-target-preset";

describe("acquisition target preset", () => {
  it("maps the climate-equipment and roofing thesis to WZ 2025 industries", () => {
    expect(climateTechnologyPreset.industryCodes).toEqual(["28.25", "43.22"]);
    expect(roofingPreset.industryCodes).toEqual(["43.41"]);
    expect(acquisitionTargetPreset.states).toContain("Baden-Württemberg");
    expect(acquisitionTargetPreset.states).toContain("Nordrhein-Westfalen");
  });

  it("lässt EBITDA in der Zusammenfassung optional", () => {
    const summary = describeAcquisitionPreset({
      industryNames: ["Dachdeckerei und Bauspenglerei"],
      states: ["Berlin"],
      legalForms: ["gmbh", "kg"],
      requireReportedEbitda: false,
      excludeOpenInsolvency: true,
    });

    expect(summary).toContain("EBITDA von 2–5 Mio. € als spätere Präferenz");
    expect(summary).toContain("laufende Insolvenzen ausgeschlossen");
  });

  it("keeps GmbHs and only GmbH & Co. KGs from the broader KG register type", () => {
    const selected = ["gmbh", "kg"];
    expect(
      matchesAcquisitionLegalForm(
        { name: "Muster GmbH", legal_form: "gmbh" },
        selected,
      ),
    ).toBe(true);
    expect(
      matchesAcquisitionLegalForm(
        { name: "Muster GmbH & Co. KG", legal_form: "kg" },
        selected,
      ),
    ).toBe(true);
    expect(
      matchesAcquisitionLegalForm(
        { name: "Muster Kommanditgesellschaft", legal_form: "kg" },
        selected,
      ),
    ).toBe(false);
  });
});
