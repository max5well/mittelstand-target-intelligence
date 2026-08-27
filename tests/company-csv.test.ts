import { describe, expect, it } from "vitest";
import { companiesToCsv } from "@/lib/company-csv";
import { companies } from "@/lib/mock-data";

describe("company CSV export", () => {
  it("exports headers and every supplied company", () => {
    const csv = companiesToCsv(companies.slice(0, 3));
    expect(csv.split("\r\n")).toHaveLength(4);
    expect(csv).toContain("OpenRegister ID");
    expect(csv).toContain(companies[0].openregisterCompanyId);
  });

  it("escapes commas and quotes", () => {
    const csv = companiesToCsv([
      { ...companies[0], name: 'Alpha, "Beta" GmbH' },
    ]);
    expect(csv).toContain('"Alpha, ""Beta"" GmbH"');
  });
});
