import { describe, expect, it } from "vitest";
import { getWz2025IndustryName, wz2025Industries } from "@/lib/wz2025";

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
});
