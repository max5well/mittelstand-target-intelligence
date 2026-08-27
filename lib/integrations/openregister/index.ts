import "server-only";
import { z } from "zod";
import { companies } from "@/lib/mock-data";
import { fetchProvider } from "../http";

export const OpenRegisterFilterSchema = z.object({
  field: z.string().min(1),
  operator: z.string().min(1),
  value: z.unknown(),
});

export const CompanySearchRequestSchema = z.object({
  query: z.object({ value: z.string() }).optional(),
  filters: z.array(OpenRegisterFilterSchema).default([]),
  location: z
    .object({
      longitude: z.number(),
      latitude: z.number(),
      radius: z.number().positive(),
    })
    .optional(),
  pagination: z
    .object({
      page: z.number().int().positive().default(1),
      per_page: z.number().int().min(1).max(100).default(50),
    })
    .default({ page: 1, per_page: 50 }),
});

const SearchItemSchema = z
  .object({
    company_id: z.string(),
    name: z.string(),
    country: z.string().nullable().optional(),
    register_number: z.string().optional(),
    register_type: z.string().optional(),
    register_court: z.string().optional(),
    active: z.boolean().optional(),
    legal_form: z.string().nullable().optional(),
    address: z.unknown().optional(),
  })
  .passthrough();
const SearchResponseSchema = z.object({
  results: z.array(SearchItemSchema),
  pagination: z.record(z.string(), z.unknown()),
});
const GenericCompanyResponseSchema = z.record(z.string(), z.unknown());

export type CompanySearchRequest = z.input<typeof CompanySearchRequestSchema>;

export class OpenRegisterProvider {
  readonly costs = {
    advancedSearch: 10,
    companyDetails: 10,
    financials: 10,
    owners: 10,
  } as const;
  private readonly baseUrl =
    process.env.OPENREGISTER_BASE_URL ?? "https://api.openregister.de";
  private readonly mock = process.env.MOCK_PROVIDERS !== "false";

  private headers() {
    const key = process.env.OPENREGISTER_API_KEY;
    if (!key) throw new Error("OPENREGISTER_API_KEY is not configured");
    return {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
  }

  async search(input: CompanySearchRequest) {
    const request = CompanySearchRequestSchema.parse(input);
    if (this.mock) {
      const start = (request.pagination.page - 1) * request.pagination.per_page;
      return {
        results: companies
          .slice(start, start + request.pagination.per_page)
          .map((company) => ({
            company_id: company.openregisterCompanyId,
            name: company.name,
            country: "DE",
            register_number: company.openregisterCompanyId,
            register_type: company.legalForm === "AG" ? "HRB" : "HRB",
            active: true,
            legal_form: company.legalForm.toLocaleLowerCase(),
          })),
        pagination: {
          page: request.pagination.page,
          per_page: request.pagination.per_page,
          total: companies.length,
          fixture: true,
        },
      };
    }
    return fetchProvider(
      `${this.baseUrl}/v1/search/company`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(request),
      },
      SearchResponseSchema,
    );
  }

  async company(companyId: string, realtime = false) {
    return this.get(
      `/v1/company/${encodeURIComponent(companyId)}${realtime ? "?realtime=true" : ""}`,
    );
  }
  async financials(companyId: string) {
    return this.get(`/v1/company/${encodeURIComponent(companyId)}/financials`);
  }
  async owners(companyId: string) {
    return this.get(`/v1/company/${encodeURIComponent(companyId)}/owners`);
  }

  private async get(path: string) {
    if (this.mock)
      return GenericCompanyResponseSchema.parse({
        fixture: true,
        fictional: true,
        path,
      });
    return fetchProvider(
      `${this.baseUrl}${path}`,
      { headers: this.headers() },
      GenericCompanyResponseSchema,
    );
  }
}
