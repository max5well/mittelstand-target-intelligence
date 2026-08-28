import { describe, expect, it } from "vitest";
import { filterCompanies, type CompanyFilters } from "@/lib/company-filters";
import type { Company } from "@/lib/types";

const companies = [
  {
    id: "company-bayern",
    name: "Bayern Technik GmbH",
    city: "München",
    state: "Bayern",
    industry: "Maschinenbau",
    openregisterCompanyId: "de-bayern",
    ownerSummary: "Familie Beispiel",
    ownership: "Family-owned",
    status: "shortlisted",
    favorite: true,
  },
  {
    id: "company-hessen",
    name: "Hessen Technik GmbH",
    city: "Frankfurt am Main",
    state: "Hessen",
    industry: "Maschinenbau",
    openregisterCompanyId: "de-hessen",
    ownerSummary: "Holding Beispiel",
    ownership: "Corporate/strategic-owned",
    status: "new",
    favorite: false,
  },
] as Company[];

const defaults: CompanyFilters = {
  query: "",
  status: "all",
  favoritesOnly: false,
  state: "all",
  city: "all",
  industry: "all",
  ownership: "all",
};

describe("company column filters", () => {
  it("filters location by Bundesland instead of matching every column", () => {
    expect(
      filterCompanies(companies, { ...defaults, state: "Bayern" }).map(
        (company) => company.id,
      ),
    ).toEqual(["company-bayern"]);
  });

  it("combines multiple column filters", () => {
    expect(
      filterCompanies(companies, {
        ...defaults,
        industry: "Maschinenbau",
        ownership: "Corporate/strategic-owned",
        status: "new",
      }).map((company) => company.id),
    ).toEqual(["company-hessen"]);
  });
});
