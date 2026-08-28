export const acquisitionTargetPreset = {
  name: "Ziele in Klima- und Dachtechnik",
  description:
    "Deutsche Akquisitionsziele in Klima- und Lüftungstechnik sowie Dachdeckerei.",
  industryCodes: ["28.25", "43.22", "43.41"],
  states: [
    "Berlin",
    "Brandenburg",
    "Bayern",
    "Nordrhein-Westfalen",
    "Baden-Württemberg",
  ],
  legalForms: ["gmbh", "kg"],
  revenueEur: { min: "10000000", max: "50000000" },
  preferredEbitdaEur: { min: "2000000", max: "5000000" },
  assumedEbitdaMargin: { min: 0.1, max: 0.2 },
  purposeKeywordSuggestions: [
    "Klima",
    "Kälte",
    "Lüftung",
    "Dach",
    "Dachdeck",
    "Bedachung",
  ],
} as const;

export function describeAcquisitionPreset(input: {
  industryNames: string[];
  states: string[];
  legalForms: string[];
  requireReportedEbitda: boolean;
  excludeOpenInsolvency: boolean;
}) {
  const legalForms = input.legalForms
    .map((form) => (form === "kg" ? "GmbH & Co. KG/KG" : form.toUpperCase()))
    .join(" und ");
  const ebitda = input.requireReportedEbitda
    ? "gemeldetes EBITDA zwischen 2 Mio. € und 5 Mio. € erforderlich"
    : "EBITDA von 2–5 Mio. € als spätere Präferenz, da es möglicherweise nicht gemeldet ist";
  const insolvency = input.excludeOpenInsolvency
    ? "laufende Insolvenzen ausgeschlossen"
    : "laufende Insolvenzen eingeschlossen";

  return `${legalForms}-Ziele in ${input.industryNames.join(", ")} in ${input.states.join(", ")}; Umsatz 10–50 Mio. €, ${ebitda}, ${insolvency}.`;
}

export function matchesAcquisitionLegalForm(
  company: { legal_form?: string | null; name: string },
  selectedLegalForms: string[],
) {
  const legalForm = company.legal_form?.toLocaleLowerCase("de") ?? "";
  if (!selectedLegalForms.includes(legalForm)) return false;
  if (legalForm !== "kg") return true;
  return /\bgmbh\s*&\s*co\.?\s*kg\b/i.test(company.name);
}
