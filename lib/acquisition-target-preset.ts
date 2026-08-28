export type AcquisitionTargetPreset = {
  name: string;
  description: string;
  industryCodes: readonly string[];
  states: readonly string[];
  legalForms: readonly string[];
  revenueEur: { readonly min: string; readonly max: string };
  preferredEbitdaEur: { readonly min: string; readonly max: string };
  assumedEbitdaMargin: { readonly min: number; readonly max: number };
  purposeKeywordSuggestions: readonly string[];
};

const sharedTargetCriteria = {
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
} as const;

export const climateTechnologyPreset: AcquisitionTargetPreset = {
  name: "Klimatechnik",
  description:
    "Deutsche Akquisitionsziele in Klima-, Kälte- und Lüftungstechnik.",
  industryCodes: ["28.25", "43.22"],
  ...sharedTargetCriteria,
  purposeKeywordSuggestions: ["Klima", "Kälte", "Lüftung", "HVAC"],
};

export const roofingPreset: AcquisitionTargetPreset = {
  name: "Dachdecker",
  description: "Deutsche Akquisitionsziele im Dachdeckerhandwerk.",
  industryCodes: ["43.41"],
  ...sharedTargetCriteria,
  purposeKeywordSuggestions: ["Dach", "Dachdeck", "Bedachung"],
};

export const acquisitionTargetPresets = [
  climateTechnologyPreset,
  roofingPreset,
] as const;

export const acquisitionTargetPreset = climateTechnologyPreset;

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
