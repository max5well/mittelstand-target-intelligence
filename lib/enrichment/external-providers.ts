import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/db/admin";
import { ApolloProvider } from "@/lib/integrations/apollo";
import { ProviderError } from "@/lib/integrations/http";
import {
  FirecrawlProvider,
  TavilyProvider,
  type WebSource,
} from "@/lib/integrations/web-research";

export const externalProviderStages = [
  "apollo_organization",
  "firecrawl_website",
  "tavily_research",
] as const;
export type ExternalProviderStage = (typeof externalProviderStages)[number];

const configuration = {
  apollo_organization: {
    provider: "apollo",
    credits: 1,
    endpoint: "GET /api/v1/organizations/enrich",
  },
  firecrawl_website: {
    provider: "firecrawl",
    credits: 1,
    endpoint: "POST /v2/scrape",
  },
  tavily_research: { provider: "tavily", credits: 2, endpoint: "POST /search" },
} as const;

export async function runExternalProviderEnrichment(input: {
  workspaceId: string;
  companyId: string;
  stage: ExternalProviderStage;
  force?: boolean;
}) {
  const supabase = createAdminClient();
  const config = configuration[input.stage];
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id,legal_name,website_url")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.companyId)
    .single();
  if (companyError || !company)
    throw new Error(companyError?.message ?? "Company not found");
  if (!company.website_url && input.stage !== "tavily_research")
    throw new Error(
      `${config.provider} needs a verified company website before this action can run.`,
    );
  const { data: location } = await supabase
    .from("company_locations")
    .select("city")
    .eq("workspace_id", input.workspaceId)
    .eq("company_id", input.companyId)
    .order("retrieved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!input.force) {
    const { data: previous } = await supabase
      .from("enrichment_jobs")
      .select("id,status,actual_credits,completed_at,payload")
      .eq("workspace_id", input.workspaceId)
      .eq("company_id", input.companyId)
      .eq("provider", config.provider)
      .eq("job_type", input.stage)
      .eq("status", "succeeded")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previous)
      return {
        job: previous,
        skipped: true,
        available:
          (previous.payload as { available?: boolean } | null)?.available !==
          false,
      };
  }

  const startedAt = new Date();
  const { data: job, error: jobError } = await supabase
    .from("enrichment_jobs")
    .insert({
      workspace_id: input.workspaceId,
      company_id: input.companyId,
      provider: config.provider,
      job_type: input.stage,
      status: "running",
      idempotency_key: `${input.companyId}:${input.stage}:${randomUUID()}`,
      payload: { website: company.website_url },
      attempt_count: 1,
      estimated_credits: config.credits,
      started_at: startedAt.toISOString(),
    })
    .select("id")
    .single();
  if (jobError || !job)
    throw new Error(jobError?.message ?? "Unable to create provider job");

  let httpStatus = 200;
  try {
    const domain = company.website_url
      ? new URL(company.website_url).hostname.replace(/^www\./, "")
      : null;
    let returned = 0;
    if (input.stage === "apollo_organization") {
      const result = await new ApolloProvider().enrichOrganization({
        domain: domain!,
        name: company.legal_name,
      });
      if (result.organization) {
        returned = 1;
        const organization = result.organization;
        const { error } = await supabase.from("apollo_organizations").upsert(
          {
            workspace_id: input.workspaceId,
            company_id: input.companyId,
            apollo_id: organization.id,
            domain: organization.primary_domain ?? domain,
            country: organization.country ?? null,
            match_confidence: null,
            estimated_employees: organization.estimated_num_employees ?? null,
            estimated_revenue_cents:
              organization.annual_revenue == null
                ? null
                : Math.round(organization.annual_revenue * 100),
            hierarchy: {},
            retrieved_at: new Date().toISOString(),
            raw_payload: result,
          },
          { onConflict: "workspace_id,apollo_id" },
        );
        if (error) throw new Error(error.message);
      }
    } else {
      const sources =
        input.stage === "firecrawl_website"
          ? await new FirecrawlProvider().research({
              companyName: company.legal_name,
              verifiedDomain: company.website_url ?? undefined,
            })
          : await new TavilyProvider().research({
              companyName: company.legal_name,
              verifiedDomain: company.website_url ?? undefined,
              city: location?.city ?? undefined,
            });
      returned = await persistWebSources(
        input.workspaceId,
        input.companyId,
        company.legal_name,
        sources,
      );
    }

    const completedAt = new Date();
    const available = returned > 0;
    const [jobResult] = await Promise.all([
      supabase
        .from("enrichment_jobs")
        .update({
          status: "succeeded",
          actual_credits: config.credits,
          completed_at: completedAt.toISOString(),
          payload: {
            website: company.website_url,
            available,
            returned,
          },
        })
        .eq("id", job.id)
        .select("id,status,actual_credits,completed_at,payload")
        .single(),
      supabase.from("provider_usage_events").insert({
        workspace_id: input.workspaceId,
        provider: config.provider,
        endpoint: config.endpoint,
        enrichment_job_id: job.id,
        estimated_credits: config.credits,
        actual_credits: config.credits,
        request_count: 1,
        http_status: httpStatus,
        duration_ms: completedAt.getTime() - startedAt.getTime(),
      }),
    ]);
    if (jobResult.error) throw new Error(jobResult.error.message);
    return { job: jobResult.data, skipped: false, available, returned };
  } catch (error) {
    if (error instanceof ProviderError) httpStatus = error.status;
    const completedAt = new Date();
    await Promise.all([
      supabase
        .from("enrichment_jobs")
        .update({
          status: "failed",
          actual_credits: config.credits,
          completed_at: completedAt.toISOString(),
          error_details: {
            message:
              error instanceof Error ? error.message : "Unknown provider error",
          },
        })
        .eq("id", job.id),
      supabase.from("provider_usage_events").insert({
        workspace_id: input.workspaceId,
        provider: config.provider,
        endpoint: config.endpoint,
        enrichment_job_id: job.id,
        estimated_credits: config.credits,
        actual_credits: config.credits,
        request_count: 1,
        http_status: httpStatus,
        duration_ms: completedAt.getTime() - startedAt.getTime(),
      }),
    ]);
    throw error;
  }
}

async function persistWebSources(
  workspaceId: string,
  companyId: string,
  companyName: string,
  sources: WebSource[],
) {
  const relevantSources = sources.filter((source) =>
    source.provider === "tavily"
      ? isRelevantTavilySource(companyName, source)
      : true,
  );
  if (!relevantSources.length) return 0;
  const { error } = await createAdminClient()
    .from("web_sources")
    .insert(
      relevantSources.map((source) => ({
        workspace_id: workspaceId,
        company_id: companyId,
        provider: source.provider,
        query: companyName,
        url: source.url,
        title: source.title,
        publication_date: toDate(source.publishedAt),
        result_score: source.score,
        supporting_excerpt: source.content.slice(0, 2000),
        retrieved_at: source.retrievedAt,
        raw_payload: source,
      })),
    );
  if (error) throw new Error(error.message);
  return relevantSources.length;
}

export function isRelevantTavilySource(companyName: string, source: WebSource) {
  const companyStem = normalizeCompanyText(
    companyName.replace(
      /\b(?:gmbh|ag|ug|kg|ohg|se|haftungsbeschränkt)\b.*$/i,
      "",
    ),
  );
  const evidence = normalizeCompanyText(
    `${source.title ?? ""} ${source.content}`,
  );
  return companyStem.length >= 5 && evidence.includes(companyStem);
}

function normalizeCompanyText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 10);
}
