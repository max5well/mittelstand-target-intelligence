import { describe, expect, it } from "vitest";
import { compileCompanyContext } from "@/lib/copilot/context";
import { companies } from "@/lib/mock-data";

describe("Copilot company context", () => {
  it("passes the complete relevant dossier with history and provenance", () => {
    const company = {
      ...companies[0],
      legalForm: "GmbH",
      address: "Musterstraße 1",
      postcode: "10115",
      incorporationDate: "1995-06-30",
      employeeYear: 2024,
      capitalCents: 410_000_000,
      financialRetrievedAt: "2026-09-02T10:00:00.000Z",
      ownershipRetrievedAt: "2026-09-02T11:00:00.000Z",
    };
    const financialPeriod = {
      fiscal_period_end: "2023-12-31",
      currency: "EUR",
      revenue_cents: 400_000_000,
      source_provider: "openregister",
    };
    const provenance = {
      provider: "openregister",
      source_identifier: "document-1",
      source_url: "https://example.com/register",
      source_date: "2024-01-01",
      retrieved_at: "2026-09-02T12:00:00.000Z",
    };
    const context = compileCompanyContext(company, {
      webSources: [],
      copilotWebSources: [
        {
          provider: "firecrawl",
          url: "https://example.com",
          title: "Company website",
          supporting_excerpt: "First-party evidence",
          retrieved_at: "2026-09-02T12:00:00.000Z",
        },
      ],
      apollo: { estimated_employees: 500 },
      financialPeriods: [financialPeriod],
      companySources: [provenance],
    });

    expect(context.identity).toMatchObject({
      legalForm: "GmbH",
      address: "Musterstraße 1",
      postcode: "10115",
      incorporationDate: "1995-06-30",
    });
    expect(context.business).toMatchObject({ employeeYear: 2024 });
    expect(context.financials).toMatchObject({
      capitalCents: 410_000_000,
      retrievedAt: "2026-09-02T10:00:00.000Z",
      history: [financialPeriod],
    });
    expect(context.ownership).toMatchObject({
      method: company.ownershipMethod,
      retrievedAt: "2026-09-02T11:00:00.000Z",
    });
    expect(context.existingExternalEvidence).toHaveLength(1);
    expect(context.provenance).toEqual([provenance]);
  });
});
