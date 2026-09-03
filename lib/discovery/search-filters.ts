export function matchesSelectedLegalForm(
  company: { legal_form?: string | null; name: string },
  selectedLegalForms: string[],
) {
  const legalForm = company.legal_form?.toLocaleLowerCase("de") ?? "";
  if (!selectedLegalForms.includes(legalForm)) return false;
  if (legalForm !== "kg") return true;
  return /\bgmbh\s*&\s*co\.?\s*kg\b/i.test(company.name);
}
