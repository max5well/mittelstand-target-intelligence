import "server-only";
import { z } from "zod";
import { companies } from "@/lib/mock-data";
import { fetchProvider, type ProviderRequestMetrics } from "../http";

export const OpenRegisterFilterSchema = z
  .object({
    field: z.string().min(1),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    min: z.union([z.string(), z.number()]).optional(),
    max: z.union([z.string(), z.number()]).optional(),
    values: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
    keywords: z.array(z.string()).optional(),
  })
  .superRefine((filter, context) => {
    if (
      filter.value === undefined &&
      filter.min === undefined &&
      filter.max === undefined &&
      !filter.values?.length &&
      !filter.keywords?.length
    ) {
      context.addIssue({
        code: "custom",
        message: "A documented OpenRegister filter value is required",
      });
    }
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

export const SearchItemSchema = z
  .object({
    company_id: z.string(),
    name: z.string(),
    country: z.string().nullable().optional(),
    register_number: z.string().optional(),
    register_type: z.string().optional(),
    register_court: z.string().optional(),
    active: z.boolean().optional(),
    legal_form: z.string().nullable().optional(),
    address: z
      .object({
        city: z.string().nullable().optional(),
        country: z.string().nullable().optional(),
        formatted_value: z.string().nullable().optional(),
        street: z.string().nullable().optional(),
        postal_code: z.string().nullable().optional(),
        extra: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();
const SearchResponseSchema = z.object({
  results: z.array(SearchItemSchema),
  pagination: z.record(z.string(), z.unknown()),
});
export type CompanySearchResponse = z.output<typeof SearchResponseSchema>;
const NullableText = z.string().nullable().optional();
const NullableNumber = z.number().nullable().optional();
const CompanyDetailsSchema = z
  .object({
    id: NullableText,
    name: z
      .union([
        z.string(),
        z
          .object({ name: NullableText, start_date: NullableText })
          .passthrough(),
      ])
      .nullable()
      .optional(),
    legal_form: NullableText,
    incorporated_at: NullableText,
    register: z
      .object({
        register_number: NullableText,
        register_type: NullableText,
        register_court: NullableText,
      })
      .passthrough()
      .nullable()
      .optional(),
    address: z.record(z.string(), z.unknown()).nullable().optional(),
    contact: z.record(z.string(), z.unknown()).nullable().optional(),
    purpose: z
      .union([z.string(), z.record(z.string(), z.unknown())])
      .nullable()
      .optional(),
    representation: z.array(z.record(z.string(), z.unknown())).optional(),
    sources: z.array(z.record(z.string(), z.unknown())).optional(),
    available: z.boolean().optional(),
  })
  .passthrough();
const FinancialsSchema = z
  .object({
    available: z.boolean().optional(),
    indicators: z
      .array(
        z
          .object({
            date: NullableText,
            consolidated: z.boolean().nullable().optional(),
            revenue: NullableNumber,
            ebitda: NullableNumber,
            ebit: NullableNumber,
            net_income: NullableNumber,
            equity: NullableNumber,
            cash: NullableNumber,
            financial_debt: NullableNumber,
            balance_sheet_total: NullableNumber,
            employees: NullableNumber,
            report_id: NullableText,
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();
const OwnersSchema = z
  .object({
    available: z.boolean().optional(),
    best_available: z.boolean().optional(),
    owners: z
      .array(
        z
          .object({
            id: NullableText,
            name: z.string(),
            type: NullableText,
            percentage_share: NullableNumber,
            nominal_share: NullableNumber,
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();
const WebsiteLookupResponseSchema = z
  .object({
    company_id: z.string(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    vat_id: z.string().nullable().optional(),
  })
  .passthrough();

export type CompanySearchRequest = z.input<typeof CompanySearchRequestSchema>;

export class OpenRegisterProvider {
  readonly costs = {
    advancedSearch: 10,
    companyDetails: 10,
    financials: 10,
    owners: 10,
    websiteLookup: 10,
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

  async search(
    input: CompanySearchRequest,
    metrics?: ProviderRequestMetrics,
  ): Promise<CompanySearchResponse> {
    const request = CompanySearchRequestSchema.parse(input);
    if (this.mock) {
      const start = (request.pagination.page - 1) * request.pagination.per_page;
      return SearchResponseSchema.parse({
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
      });
    }
    return fetchProvider(
      `${this.baseUrl}/v1/search/company`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(request),
      },
      SearchResponseSchema,
      3,
      metrics,
    );
  }

  async company(companyId: string, metrics?: ProviderRequestMetrics) {
    return this.get(
      `/v1/company/${encodeURIComponent(companyId)}`,
      CompanyDetailsSchema,
      metrics,
    );
  }
  async financials(companyId: string, metrics?: ProviderRequestMetrics) {
    return this.get(
      `/v1/company/${encodeURIComponent(companyId)}/financials`,
      FinancialsSchema,
      metrics,
    );
  }
  async owners(companyId: string, metrics?: ProviderRequestMetrics) {
    const query = new URLSearchParams({ best_available: "true" });
    return this.get(
      `/v1/company/${encodeURIComponent(companyId)}/owners?${query}`,
      OwnersSchema,
      metrics,
    );
  }

  async lookupCompanyByUrl(url: string, metrics?: ProviderRequestMetrics) {
    if (this.mock)
      return WebsiteLookupResponseSchema.parse({
        company_id: companies[0]?.openregisterCompanyId ?? "or_mock_18001",
      });
    const query = new URLSearchParams({ url });
    return fetchProvider(
      `${this.baseUrl}/v0/search/lookup?${query.toString()}`,
      { headers: this.headers() },
      WebsiteLookupResponseSchema,
      1,
      metrics,
    );
  }

  private async get<T extends z.ZodType>(
    path: string,
    schema: T,
    metrics?: ProviderRequestMetrics,
  ) {
    if (this.mock)
      return schema.parse({
        fixture: true,
        fictional: true,
        path,
      });
    return fetchProvider(
      `${this.baseUrl}${path}`,
      { headers: this.headers() },
      schema,
      3,
      metrics,
    );
  }
}
