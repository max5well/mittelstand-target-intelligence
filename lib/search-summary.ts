export type SavedSearchFilter = {
  field: string;
  value?: string | number | boolean;
  min?: string | number;
  max?: string | number;
  values?: Array<string | number | boolean>;
  keywords?: string[];
};

const rangeLabels: Record<string, string> = {
  employees: "Beschäftigte",
  revenue: "Umsatz",
  ebitda: "EBITDA",
  incorporated_at: "Gründungsdatum",
  ebit: "EBIT",
  equity: "Eigenkapital",
  financial_debt: "Finanzverbindlichkeiten",
  balance_sheet_total: "Bilanzsumme",
  youngest_owner_age: "Mindestalter des jüngsten Eigentümers",
};

const moneyFields = new Set([
  "revenue",
  "ebitda",
  "ebit",
  "equity",
  "financial_debt",
  "balance_sheet_total",
]);

function formatBound(field: string, value: string | number) {
  if (moneyFields.has(field)) {
    const amount = Number(value);
    if (Number.isFinite(amount)) {
      return `${new Intl.NumberFormat("de-DE", {
        maximumFractionDigits: 0,
      }).format(amount / 100)} €`;
    }
  }
  return String(value);
}

function formatRange(filter: SavedSearchFilter) {
  const label = rangeLabels[filter.field];
  if (!label) return null;
  if (filter.min !== undefined && filter.max !== undefined)
    return `${label}: ${formatBound(filter.field, filter.min)}–${formatBound(filter.field, filter.max)}`;
  if (filter.min !== undefined)
    return `${label}: ab ${formatBound(filter.field, filter.min)}`;
  if (filter.max !== undefined)
    return `${label}: bis ${formatBound(filter.field, filter.max)}`;
  return null;
}

export function describeSavedSearch({
  filters,
  industryNames,
  states,
}: {
  filters: SavedSearchFilter[];
  industryNames: string[];
  states: string[];
}) {
  const descriptions: string[] = [];
  const byField = new Map(filters.map((filter) => [filter.field, filter]));

  if (byField.get("status")?.value === "active")
    descriptions.push("Nur aktive Unternehmen");

  if (industryNames.length)
    descriptions.push(`Branchen: ${industryNames.join(", ")}`);

  descriptions.push(
    states.length ? `Regionen: ${states.join(", ")}` : "Deutschlandweit",
  );

  const legalForms = byField.get("legal_form")?.values ?? [];
  if (legalForms.length) {
    descriptions.push(
      `Rechtsformen: ${legalForms
        .map((form) =>
          form === "kg" ? "GmbH & Co. KG/KG" : String(form).toUpperCase(),
        )
        .join(", ")}`,
    );
  }

  for (const filter of filters) {
    const range = formatRange(filter);
    if (range) descriptions.push(range);
  }

  const purposeKeywords = byField.get("purpose")?.keywords ?? [];
  if (purposeKeywords.length)
    descriptions.push(`Unternehmensgegenstand: ${purposeKeywords.join(", ")}`);

  const featureLabels: Record<string, string> = {
    has_representative_owner: "inhabergeführt",
    is_family_owned: "familiengeführt",
    has_sole_owner: "Alleineigentümer",
  };
  for (const [field, label] of Object.entries(featureLabels)) {
    if (byField.get(field)?.value === "true") descriptions.push(label);
  }
  if (byField.get("has_open_insolvency")?.value === "false")
    descriptions.push("laufende Insolvenzen ausgeschlossen");

  if (descriptions.length === 1 && descriptions[0] === "Deutschlandweit")
    return "Deutschlandweite Suche ohne zusätzliche Filter.";

  return `${descriptions.join("; ")}.`;
}
