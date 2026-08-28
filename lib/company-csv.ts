import type { Company } from "@/lib/types";

const headers = [
  "Unternehmen",
  "Registerangabe",
  "Registergericht",
  "OpenRegister ID",
  "Rechtsform",
  "Ort",
  "Bundesland",
  "Postleitzahl",
  "WZ-2025-Code",
  "Branche",
  "Beschäftigte",
  "Beschäftigtenjahr",
  "Umsatz EUR",
  "EBITDA EUR",
  "Geschäftsjahr",
  "Eigentümerstruktur",
  "Eigentümer-Konfidenz",
  "Eigentümer-Methode",
  "Status",
  "Eignungswert",
  "Favorit",
  "Website",
] as const;

function escapeCsv(value: string | number | boolean | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function companiesToCsv(companies: Company[]): string {
  const lines = companies.map((company) =>
    [
      company.name,
      company.registerReference,
      company.registerCourt,
      company.openregisterCompanyId,
      company.legalForm,
      company.city,
      company.state,
      company.postcode,
      company.industryCode,
      company.industry,
      company.employees,
      company.employeeYear,
      company.revenueCents === null ? null : company.revenueCents / 100,
      company.ebitdaCents === null ? null : company.ebitdaCents / 100,
      company.fiscalYear,
      company.ownership,
      company.ownershipConfidence,
      company.ownershipMethod,
      company.status,
      company.score,
      company.favorite,
      company.website,
    ]
      .map(escapeCsv)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\r\n");
}
