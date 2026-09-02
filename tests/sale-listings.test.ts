import { describe, expect, it } from "vitest";
import {
  formatSaleListingLocation,
  summarizeSaleListingDescription,
  summarizeSaleListingTitle,
} from "@/lib/sale-listings";

describe("sale listing presentation", () => {
  it("turns the long catering offer into a concise title", () => {
    const original =
      "Prämierter und innovativer Veranstalter mit Catering und Event-Location im Süden von Deutschland";
    expect(summarizeSaleListingTitle(original)).toBe(
      "Catering and Event Location",
    );
    expect(
      summarizeSaleListingDescription(original, "100 % der Anteile."),
    ).toContain("Prämierter Veranstalter");
  });

  it("uses category summaries for other promotional titles", () => {
    expect(
      summarizeSaleListingTitle(
        "Erfolgreiches Unternehmen für Kunststoffspritzguss im Rahmen einer Nachfolge",
      ),
    ).toBe("Kunststoffspritzguss");
  });

  it("prioritizes the title over incidental words in the description", () => {
    expect(
      summarizeSaleListingTitle(
        "Junges, ertragreiches Dienstleistungsunternehmen der Industrie sucht Investor",
        "Der Betrieb übernimmt auch industrielle Beschichtungen.",
      ),
    ).toBe("Industriedienstleister");
    expect(
      summarizeSaleListingTitle(
        "Hersteller hochwertiger Beton- und Gestaltungslösungen",
        "Produkte für anspruchsvolle Architektur.",
      ),
    ).toBe("Beton- und Gestaltungslösungen");
  });

  it("keeps descriptions brief and expands regional location codes", () => {
    expect(
      summarizeSaleListingDescription("Angebot", "A".repeat(300)).length,
    ).toBeLessThanOrEqual(211);
    expect(formatSaleListingLocation("Süd")).toBe("Süddeutschland");
    expect(formatSaleListingLocation(null)).toBe("Deutschland");
  });
});
