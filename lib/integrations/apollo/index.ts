import "server-only";
import { z } from "zod";
import { fetchProvider } from "../http";

const ApolloOrganizationSchema = z
  .object({
    organization: z
      .object({
        id: z.string(),
        name: z.string(),
        website_url: z.string().nullable().optional(),
        primary_domain: z.string().nullable().optional(),
        estimated_num_employees: z.number().nullable().optional(),
        annual_revenue: z.number().nullable().optional(),
        country: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable(),
  })
  .passthrough();

export class ApolloProvider {
  isAvailable() {
    return (
      Boolean(process.env.APOLLO_API_KEY) ||
      process.env.MOCK_PROVIDERS !== "false"
    );
  }
  async enrichOrganization(input: {
    domain: string;
    name?: string;
    linkedinUrl?: string;
  }) {
    const parsed = z
      .object({
        domain: z.string().min(3),
        name: z.string().optional(),
        linkedinUrl: z.string().url().optional(),
      })
      .parse(input);
    if (process.env.MOCK_PROVIDERS !== "false")
      return ApolloOrganizationSchema.parse({
        organization: {
          id: "apollo_mock_1",
          name: parsed.name ?? "Fictional Target GmbH",
          website_url: `https://${parsed.domain}`,
          primary_domain: parsed.domain,
          estimated_num_employees: 204,
          annual_revenue: 58_000_000,
          country: "Germany",
          fixture: true,
        },
      });
    return fetchProvider(
      "https://api.apollo.io/api/v1/organizations/enrich",
      {
        method: "POST",
        headers: {
          "X-Api-Key": process.env.APOLLO_API_KEY ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain: parsed.domain,
          organization_name: parsed.name,
          organization_linkedin_url: parsed.linkedinUrl,
        }),
      },
      ApolloOrganizationSchema,
    );
  }
}
