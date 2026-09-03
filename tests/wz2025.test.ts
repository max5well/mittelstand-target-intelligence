import { describe, expect, it } from "vitest";
import {
  filterWz2025Industries,
  getWz2025IndustryName,
  wz2025Industries,
} from "@/lib/wz2025";

describe("WZ-2025-Bezeichnungen", () => {
  it("ordnet Quellcodes amtlichen deutschen Namen zu", () => {
    expect(getWz2025IndustryName("86.22")).toBe("Facharztpraxen");
    expect(getWz2025IndustryName("26.40")).toBe(
      "Herstellung von Geräten der Unterhaltungselektronik",
    );
  });

  it("stellt die vollständige Klassenliste für die Namensauswahl bereit", () => {
    expect(wz2025Industries).toHaveLength(651);
  });

  it("filtert Branchen nach WZ-Code und weiterhin nach Namen", () => {
    expect(
      filterWz2025Industries("43").some(
        (industry) => industry.code === "43.22",
      ),
    ).toBe(true);
    expect(filterWz2025Industries("43.22")).toEqual([
      {
        code: "43.22",
        name: "Gas-, Wasser-, Heizungs- sowie Lüftungs- und Klimainstallation",
      },
    ]);
    expect(filterWz2025Industries("4322")).toEqual(
      filterWz2025Industries("43.22"),
    );
    expect(
      filterWz2025Industries("Elektronik").some(
        (industry) => industry.code === "26.40",
      ),
    ).toBe(true);
  });
});
