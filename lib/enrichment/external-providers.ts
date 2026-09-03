import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/db/admin";
import { recoverConflictingJobLease } from "@/lib/enrichment/job-leases";
import { ApolloProvider } from "@/lib/integrations/apollo";
import {
  creditsForProviderOutcome,
  ProviderError,
  type ProviderRequestMetrics,
} from "@/lib/integrations/http";
import { OpenRegisterProvider } from "@/lib/integrations/openregister";
import {
  FirecrawlProvider,
  TavilyProvider,
  type WebSource,
} from "@/lib/integrations/web-research";
import {
  estimateOpenRouterTokens,
  extractIntelligence,
  type ReviewedIntelligence,
} from "@/lib/integrations/openrouter/extract";
import { isOpenRegisterId } from "@/lib/openregister-id";
import { isPublicHttpUrl, isSameWebsiteUrl } from "@/lib/url-safety";
import { resolvePublicHttpUrl } from "@/lib/url-safety-server";

export const externalProviderStages = [
  "website_discovery",
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

const DEFAULT_OPENROUTER_DAILY_TOKEN_LIMIT = 100_000;

type ProviderUsageEvent = {
  workspace_id: string;
  provider: string;
  endpoint: string;
  enrichment_job_id: string;
  estimated_credits: number;
  actual_credits: number | null;
  request_count: number;
  http_status: number | null;
  duration_ms: number;
  usage_unit?: "provider_credits" | "tokens";
  estimated_units?: number;
  actual_units?: number;
  input_units?: number;
  output_units?: number;
  actual_cost_micros?: number;
};

export function openRouterDailyTokenLimit(
  value = process.env.OPENROUTER_DAILY_TOKEN_LIMIT,
) {
  const parsed = Number(value ?? DEFAULT_OPENROUTER_DAILY_TOKEN_LIMIT);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_OPENROUTER_DAILY_TOKEN_LIMIT;
}

async function hasOpenRouterDailyBudget(
  supabase: ReturnType<typeof createAdminClient>,
  estimatedTokens: number,
) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  let usedTokens = 0;
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("provider_usage_events")
      .select("actual_units,estimated_units")
      .eq("provider", "openrouter")
      .gte("occurred_at", startOfDay.toISOString())
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error)
      throw new Error(`Unable to check OpenRouter budget: ${error.message}`);
    const page = data ?? [];
    usedTokens += page.reduce(
      (total, event) =>
        total + Number(event.actual_units ?? event.estimated_units ?? 0),
      0,
    );
    if (usedTokens + estimatedTokens > openRouterDailyTokenLimit())
      return false;
    if (page.length < pageSize) break;
  }
  return usedTokens + estimatedTokens <= openRouterDailyTokenLimit();
}

export async function runExternalProviderEnrichment(input: {
  workspaceId: string;
  companyId: string;
  stage: ExternalProviderStage;
  force?: boolean;
  searchRunId?: string | null;
}) {
  if (input.stage === "website_discovery") return runWebsiteDiscovery(input);
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
  const safeWebsite = company.website_url
    ? await resolvePublicHttpUrl(company.website_url)
    : null;
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
  const leaseExpiresAt = new Date(startedAt.getTime() + 55_000);
  const insertJob = () =>
    supabase
      .from("enrichment_jobs")
      .insert({
        workspace_id: input.workspaceId,
        company_id: input.companyId,
        provider: config.provider,
        job_type: input.stage,
        status: "running",
        idempotency_key: `${input.companyId}:${input.stage}:${randomUUID()}`,
        payload: { website: safeWebsite },
        attempt_count: 1,
        estimated_credits: config.credits,
        started_at: startedAt.toISOString(),
        heartbeat_at: startedAt.toISOString(),
        lease_expires_at: leaseExpiresAt.toISOString(),
      })
      .select("id")
      .single();
  let { data: job, error: jobError } = await insertJob();
  if (jobError?.code === "23505") {
    const conflict = await recoverConflictingJobLease(supabase, {
      workspaceId: input.workspaceId,
      companyId: input.companyId,
      provider: config.provider,
      jobType: input.stage,
    });
    if (conflict.retry) ({ data: job, error: jobError } = await insertJob());
    const active = conflict.active;
    if (active)
      return { job: active, skipped: true, available: false, running: true };
  }
  if (jobError || !job)
    throw new Error(jobError?.message ?? "Unable to create provider job");

  let httpStatus = 200;
  let requestCount = 0;
  let reportedCredits: number | null = null;
  let sourceMetrics: Record<string, unknown> = {};
  const supplementalUsageEvents: ProviderUsageEvent[] = [];
  try {
    const domain = safeWebsite
      ? new URL(safeWebsite).hostname.replace(/^www\./, "")
      : null;
    let returned = 0;
    if (input.stage === "apollo_organization") {
      const provider = new ApolloProvider();
      const result = await provider.enrichOrganization({
        domain: domain!,
        name: company.legal_name,
      });
      requestCount = provider.lastRequestCount;
      if (result.organization) {
        returned = 1;
        const organization = result.organization;
        const { error } = await supabase.from("apollo_organizations").upsert(
          {
            workspace_id: input.workspaceId,
            company_id: input.companyId,
            apollo_id: organization.id ?? `domain:${domain}`,
            domain: organization.primary_domain ?? domain,
            country: organization.country ?? null,
            match_confidence: null,
            estimated_employees: organization.estimated_num_employees ?? null,
            estimated_revenue_cents:
              organization.annual_revenue == null
                ? null
                : Math.round(organization.annual_revenue * 100),
            hierarchy: {
              ownedBy: organization.owned_by_organization ?? null,
              ultimateParent: organization.ultimate_parent_organization ?? null,
              technologies: organization.technologies ?? [],
              industry: organization.industry ?? null,
              foundedYear: organization.founded_year ?? null,
              totalFunding: organization.total_funding ?? null,
            },
            retrieved_at: new Date().toISOString(),
            raw_payload: result,
          },
          { onConflict: "workspace_id,apollo_id" },
        );
        if (error) throw new Error(error.message);
      }
    } else {
      let sources: WebSource[];
      if (input.stage === "firecrawl_website") {
        const provider = new FirecrawlProvider();
        sources = await provider.research({
          companyName: company.legal_name,
          verifiedDomain: safeWebsite ?? undefined,
        });
        requestCount = provider.lastRequestCount;
        reportedCredits = provider.lastCreditsUsed;
      } else {
        const provider = new TavilyProvider();
        sources = await provider.research({
          companyName: company.legal_name,
          verifiedDomain: safeWebsite ?? undefined,
          city: location?.city ?? undefined,
        });
        requestCount = provider.lastRequestCount;
      }
      const persistence = await persistWebSources(
        input.workspaceId,
        input.companyId,
        company.legal_name,
        sources,
        safeWebsite,
      );
      returned = persistence.persisted.length;
      let aiReview: "disabled" | "capped" | "succeeded" | "failed" = "disabled";
      let claimCount = 0;
      const aiTokenEstimate = estimateOpenRouterTokens(persistence.accepted);
      let aiTokensUsed: number | null = null;
      if (process.env.OPENROUTER_API_KEY && persistence.accepted.length) {
        const hasBudget = await hasOpenRouterDailyBudget(
          supabase,
          aiTokenEstimate,
        );
        if (!hasBudget) {
          aiReview = "capped";
        } else {
          const reviewStartedAt = Date.now();
          try {
            const review = await extractIntelligence(
              company.legal_name,
              persistence.accepted,
            );
            if (review) {
              const promptTokens = review.usage?.prompt_tokens ?? 0;
              const completionTokens = review.usage?.completion_tokens ?? 0;
              aiTokensUsed =
                review.usage?.total_tokens ?? promptTokens + completionTokens;
              supplementalUsageEvents.push({
                workspace_id: input.workspaceId,
                provider: "openrouter",
                endpoint: `POST /api/v1/chat/completions (${review.model})`,
                enrichment_job_id: job.id,
                estimated_credits: 0,
                actual_credits: 0,
                request_count: review.requestCount,
                http_status: 200,
                duration_ms: Date.now() - reviewStartedAt,
                usage_unit: "tokens",
                estimated_units: review.estimatedTokens,
                actual_units: aiTokensUsed,
                input_units: promptTokens,
                output_units: completionTokens,
                actual_cost_micros:
                  review.usage?.cost == null
                    ? undefined
                    : Math.round(review.usage.cost * 1_000_000),
              });
              claimCount = await persistWebClaims(
                input.workspaceId,
                input.companyId,
                persistence.persisted,
                review,
              );
              aiReview = "succeeded";
            }
          } catch (error) {
            aiReview = "failed";
            supplementalUsageEvents.push({
              workspace_id: input.workspaceId,
              provider: "openrouter",
              endpoint: "POST /api/v1/chat/completions",
              enrichment_job_id: job.id,
              estimated_credits: 0,
              actual_credits: 0,
              request_count:
                error instanceof ProviderError ? error.requestCount : 1,
              http_status: error instanceof ProviderError ? error.status : null,
              duration_ms: Date.now() - reviewStartedAt,
              usage_unit: "tokens",
              estimated_units: aiTokenEstimate,
              actual_units: 0,
            });
            console.error("[enrichment] OpenRouter evidence review failed", {
              companyId: input.companyId,
              stage: input.stage,
              message: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      }
      console.info("[enrichment] web source processing completed", {
        companyId: input.companyId,
        stage: input.stage,
        candidates: persistence.candidateCount,
        accepted: returned,
        rejected: persistence.candidateCount - returned,
        aiReview,
        claimCount,
        aiTokenEstimate,
        aiTokensUsed,
      });
      sourceMetrics = {
        candidates: persistence.candidateCount,
        rejected: persistence.candidateCount - returned,
        rejectionReasons: persistence.rejectionReasons,
        aiReview,
        claimCount,
        aiTokenEstimate,
        aiTokensUsed,
      };
    }

    const completedAt = new Date();
    const available = returned > 0;
    const actualCredits =
      process.env.MOCK_PROVIDERS === "false"
        ? (reportedCredits ?? config.credits)
        : 0;
    const [jobResult] = await Promise.all([
      supabase
        .from("enrichment_jobs")
        .update({
          status: "succeeded",
          actual_credits: actualCredits,
          completed_at: completedAt.toISOString(),
          lease_expires_at: null,
          payload: {
            website: safeWebsite,
            available,
            returned,
            ...sourceMetrics,
          },
        })
        .eq("id", job.id)
        .select("id,status,actual_credits,completed_at,payload")
        .single(),
      supabase.from("provider_usage_events").insert([
        {
          workspace_id: input.workspaceId,
          provider: config.provider,
          endpoint: config.endpoint,
          enrichment_job_id: job.id,
          estimated_credits: config.credits,
          actual_credits: actualCredits,
          request_count: Math.max(1, requestCount),
          http_status: httpStatus,
          duration_ms: completedAt.getTime() - startedAt.getTime(),
        },
        ...supplementalUsageEvents,
      ]),
    ]);
    if (jobResult.error) throw new Error(jobResult.error.message);
    return {
      job: jobResult.data,
      skipped: false,
      available,
      returned,
      ...sourceMetrics,
    };
  } catch (error) {
    if (error instanceof ProviderError) httpStatus = error.status;
    const attempts =
      error instanceof ProviderError
        ? error.requestCount
        : Math.max(1, requestCount);
    const actualCredits =
      process.env.MOCK_PROVIDERS === "false"
        ? creditsForProviderOutcome(config.credits, error, attempts)
        : 0;
    const completedAt = new Date();
    await Promise.all([
      supabase
        .from("enrichment_jobs")
        .update({
          status: "failed",
          actual_credits: actualCredits,
          completed_at: completedAt.toISOString(),
          lease_expires_at: null,
          error_details: {
            message:
              error instanceof Error ? error.message : "Unknown provider error",
          },
        })
        .eq("id", job.id),
      supabase.from("provider_usage_events").insert([
        {
          workspace_id: input.workspaceId,
          provider: config.provider,
          endpoint: config.endpoint,
          enrichment_job_id: job.id,
          estimated_credits: config.credits,
          actual_credits: actualCredits,
          request_count: attempts,
          http_status: httpStatus,
          duration_ms: completedAt.getTime() - startedAt.getTime(),
        },
        ...supplementalUsageEvents,
      ]),
    ]);
    throw error;
  }
}

async function runWebsiteDiscovery(input: {
  workspaceId: string;
  companyId: string;
  force?: boolean;
  searchRunId?: string | null;
}) {
  const supabase = createAdminClient();
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select(
      "id,legal_name,website_url,openregister_company_id,raw_provider_payload",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.companyId)
    .single();
  if (companyError || !company)
    throw new Error(companyError?.message ?? "Company not found");
  if (company.website_url && !input.force)
    return {
      skipped: true,
      available: true,
      returned: 1,
      website: company.website_url,
    };

  const { data: location } = await supabase
    .from("company_locations")
    .select("address_line,postcode,city")
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
      .eq("provider", "tavily")
      .eq("job_type", "website_discovery")
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
  const leaseExpiresAt = new Date(startedAt.getTime() + 55_000);
  const insertJob = () =>
    supabase
      .from("enrichment_jobs")
      .insert({
        workspace_id: input.workspaceId,
        company_id: input.companyId,
        search_run_id: input.searchRunId ?? null,
        provider: "tavily",
        job_type: "website_discovery",
        status: "running",
        idempotency_key: `${input.companyId}:website_discovery:${randomUUID()}`,
        payload: {
          legalName: company.legal_name,
          city: location?.city ?? null,
        },
        attempt_count: 1,
        estimated_credits: input.searchRunId ? 4 : 14,
        started_at: startedAt.toISOString(),
        heartbeat_at: startedAt.toISOString(),
        lease_expires_at: leaseExpiresAt.toISOString(),
      })
      .select("id")
      .single();
  let { data: job, error: jobError } = await insertJob();
  if (jobError?.code === "23505") {
    const conflict = await recoverConflictingJobLease(supabase, {
      workspaceId: input.workspaceId,
      companyId: input.companyId,
      provider: "tavily",
      jobType: "website_discovery",
    });
    if (conflict.retry) ({ data: job, error: jobError } = await insertJob());
    const active = conflict.active;
    if (active)
      return { job: active, skipped: true, available: false, running: true };
  }
  if (jobError || !job)
    throw new Error(
      jobError?.message ?? "Unable to create website discovery job",
    );

  const usageEvents: Array<{
    workspace_id: string;
    provider: string;
    endpoint: string;
    enrichment_job_id: string;
    estimated_credits: number;
    actual_credits: number;
    request_count: number;
    http_status: number | null;
    duration_ms: number;
  }> = [];
  const attempts: Array<{
    provider: "tavily" | "firecrawl" | "openregister";
    status: "succeeded" | "failed" | "skipped";
    httpStatus?: number;
    returned?: number;
    message?: string;
  }> = [];
  try {
    const profile = buildWebsiteVerificationProfile({
      companyName: company.legal_name,
      city: location?.city,
      addressLine: location?.address_line,
      postcode: location?.postcode,
      rawProviderPayload: company.raw_provider_payload,
    });
    let verifiedWebsite: string | null = null;
    let verification = "no_verified_match";
    let evidenceSignals: WebsiteEvidenceSignal[] = [];
    let selectedSources: WebSource[] = [];
    let lookupBlocked = false;
    let openRegisterLookupAttempted = false;
    const allowOpenRegisterLookup = !input.searchRunId;
    const tavily = new TavilyProvider();
    const firecrawl = new FirecrawlProvider();

    const discover = async (
      provider: "tavily" | "firecrawl",
      endpoint: string,
      request: () => Promise<WebSource[]>,
      telemetry: () => { requestCount: number; reportedCredits: number | null },
    ) => {
      const requestStartedAt = Date.now();
      try {
        const sources = await request();
        const usage = telemetry();
        const actualCredits =
          process.env.MOCK_PROVIDERS === "false"
            ? (usage.reportedCredits ?? 2)
            : 0;
        attempts.push({
          provider,
          status: "succeeded",
          returned: sources.length,
        });
        usageEvents.push({
          workspace_id: input.workspaceId,
          provider,
          endpoint,
          enrichment_job_id: job.id,
          estimated_credits: 2,
          actual_credits: actualCredits,
          request_count: Math.max(1, usage.requestCount),
          http_status: 200,
          duration_ms: Date.now() - requestStartedAt,
        });
        return sources;
      } catch (error) {
        const status = error instanceof ProviderError ? error.status : 500;
        const usage = telemetry();
        const requestCount =
          error instanceof ProviderError
            ? error.requestCount
            : Math.max(1, usage.requestCount);
        attempts.push({
          provider,
          status: "failed",
          httpStatus: status,
          message: error instanceof Error ? error.message : "Provider failed",
        });
        usageEvents.push({
          workspace_id: input.workspaceId,
          provider,
          endpoint,
          enrichment_job_id: job.id,
          estimated_credits: 2,
          actual_credits:
            process.env.MOCK_PROVIDERS === "false"
              ? creditsForProviderOutcome(2, error, requestCount)
              : 0,
          request_count: requestCount,
          http_status: status,
          duration_ms: Date.now() - requestStartedAt,
        });
        return null;
      }
    };

    const verifyCandidates = async (sources: WebSource[]) => {
      const candidates = selectOfficialWebsiteCandidates(
        company.legal_name,
        sources,
      );
      for (const candidate of candidates) {
        const evidenceMatch = verifyOfficialWebsiteEvidence(
          profile,
          candidate.sources,
        );
        if (evidenceMatch.matched) {
          verifiedWebsite = candidate.url;
          verification = `${candidate.source.provider}_profile_evidence_match`;
          evidenceSignals = evidenceMatch.signals;
          selectedSources = candidate.sources;
          return true;
        }
      }
      if (
        allowOpenRegisterLookup &&
        !openRegisterLookupAttempted &&
        !lookupBlocked &&
        isOpenRegisterId(company.openregister_company_id)
      ) {
        for (const candidate of candidates.slice(0, 1)) {
          openRegisterLookupAttempted = true;
          const requestStartedAt = Date.now();
          const lookupMetrics: ProviderRequestMetrics = { requestCount: 0 };
          try {
            const match = await new OpenRegisterProvider().lookupCompanyByUrl(
              candidate.url,
              lookupMetrics,
            );
            attempts.push({
              provider: "openregister",
              status: "succeeded",
              httpStatus: 200,
              returned: 1,
            });
            usageEvents.push({
              workspace_id: input.workspaceId,
              provider: "openregister",
              endpoint: "GET /v0/search/lookup",
              enrichment_job_id: job.id,
              estimated_credits: 10,
              actual_credits: process.env.MOCK_PROVIDERS === "false" ? 10 : 0,
              request_count: Math.max(1, lookupMetrics.requestCount),
              http_status: 200,
              duration_ms: Date.now() - requestStartedAt,
            });
            if (match.company_id === company.openregister_company_id) {
              verifiedWebsite = candidate.url;
              verification = "openregister_company_id_match";
              selectedSources = candidate.sources;
              return true;
            }
          } catch (error) {
            const status = error instanceof ProviderError ? error.status : 500;
            const requestCount =
              error instanceof ProviderError
                ? error.requestCount
                : Math.max(1, lookupMetrics.requestCount);
            attempts.push({
              provider: "openregister",
              status: "failed",
              httpStatus: status,
              message:
                error instanceof Error ? error.message : "Provider failed",
            });
            usageEvents.push({
              workspace_id: input.workspaceId,
              provider: "openregister",
              endpoint: "GET /v0/search/lookup",
              enrichment_job_id: job.id,
              estimated_credits: 10,
              actual_credits:
                process.env.MOCK_PROVIDERS === "false"
                  ? creditsForProviderOutcome(10, error, requestCount)
                  : 0,
              request_count: requestCount,
              http_status: status,
              duration_ms: Date.now() - requestStartedAt,
            });
            if (status !== 404) lookupBlocked = true;
            if (lookupBlocked) break;
          }
        }
      }
      return false;
    };

    let tavilySources: WebSource[] | null = null;
    if (tavily.isAvailable())
      tavilySources = await discover(
        "tavily",
        "POST /search (website discovery)",
        () =>
          tavily.discoverOfficialWebsite({
            companyName: company.legal_name,
            city: profile.city ?? undefined,
          }),
        () => ({
          requestCount: tavily.lastRequestCount,
          reportedCredits: null,
        }),
      );
    else attempts.push({ provider: "tavily", status: "skipped" });

    if (tavilySources?.length) await verifyCandidates(tavilySources);

    if (!verifiedWebsite) {
      if (firecrawl.isAvailable()) {
        const firecrawlSources = await discover(
          "firecrawl",
          "POST /v2/search (website discovery)",
          () =>
            firecrawl.discoverOfficialWebsite({
              companyName: company.legal_name,
              city: profile.city ?? undefined,
            }),
          () => ({
            requestCount: firecrawl.lastRequestCount,
            reportedCredits: firecrawl.lastCreditsUsed,
          }),
        );
        if (firecrawlSources?.length) await verifyCandidates(firecrawlSources);
      } else attempts.push({ provider: "firecrawl", status: "skipped" });
    }

    const providerFailures = attempts.filter(
      (attempt) => attempt.status === "failed",
    );
    const providerSuccesses = attempts.filter(
      (attempt) =>
        attempt.status === "succeeded" && attempt.provider !== "openregister",
    );
    if (!providerSuccesses.length && providerFailures.length)
      throw new Error(
        providerFailures.map((attempt) => attempt.message).join(" "),
      );
    if (!providerSuccesses.length)
      throw new Error(
        "Website discovery requires a configured Tavily or Firecrawl provider.",
      );

    if (verifiedWebsite) {
      const { error } = await supabase
        .from("companies")
        .update({
          website_url: verifiedWebsite,
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", input.workspaceId)
        .eq("id", input.companyId);
      if (error) throw new Error(error.message);
      await persistWebSources(
        input.workspaceId,
        input.companyId,
        company.legal_name,
        selectedSources,
        verifiedWebsite,
      );
    }

    const completedAt = new Date();
    const actualCredits = usageEvents.reduce(
      (total, event) => total + event.actual_credits,
      0,
    );
    const available = Boolean(verifiedWebsite);
    const [jobResult] = await Promise.all([
      supabase
        .from("enrichment_jobs")
        .update({
          status: "succeeded",
          actual_credits: actualCredits,
          completed_at: completedAt.toISOString(),
          lease_expires_at: null,
          payload: {
            available,
            returned: available ? 1 : 0,
            website: verifiedWebsite,
            verification,
            evidenceSignals,
            attempts,
          },
        })
        .eq("id", job.id)
        .select("id,status,actual_credits,completed_at,payload")
        .single(),
      usageEvents.length
        ? supabase.from("provider_usage_events").insert(usageEvents)
        : Promise.resolve({ error: null }),
    ]);
    if (jobResult.error) throw new Error(jobResult.error.message);
    return {
      job: jobResult.data,
      skipped: false,
      available,
      returned: available ? 1 : 0,
      website: verifiedWebsite,
    };
  } catch (error) {
    const completedAt = new Date();
    const actualCredits = usageEvents.reduce(
      (total, event) => total + event.actual_credits,
      0,
    );
    await Promise.all([
      supabase
        .from("enrichment_jobs")
        .update({
          status: "failed",
          actual_credits: actualCredits,
          completed_at: completedAt.toISOString(),
          lease_expires_at: null,
          error_details: {
            message:
              error instanceof Error
                ? error.message
                : "Website discovery failed",
          },
        })
        .eq("id", job.id),
      usageEvents.length
        ? supabase.from("provider_usage_events").insert(usageEvents)
        : Promise.resolve({ error: null }),
    ]);
    throw error;
  }
}

const NON_OFFICIAL_HOSTS = new Set([
  "11880.com",
  "arzt-auskunft.de",
  "companyhouse.de",
  "dasoertliche.de",
  "dastelefonbuch.de",
  "doctolib.de",
  "gelbeseiten.de",
  "handelsregister.ai",
  "northdata.de",
  "openregister.de",
  "handelsregister.de",
  "unternehmensregister.de",
  "bundesanzeiger.de",
  "linkedin.com",
  "xing.com",
  "facebook.com",
  "instagram.com",
  "jameda.de",
  "total-lokal.de",
  "werkenntdenbesten.de",
  "wikipedia.org",
]);

type OfficialWebsiteCandidate = {
  url: string;
  source: WebSource;
  sources: WebSource[];
};

export type WebsiteEvidenceSignal =
  "company_name" | "city" | "street_address" | "postcode" | "representative";

export type WebsiteVerificationProfile = {
  companyName: string;
  city?: string | null;
  addressLine?: string | null;
  postcode?: string | null;
  representatives?: string[];
};

export function selectOfficialWebsiteCandidates(
  companyName: string,
  sources: WebSource[],
): OfficialWebsiteCandidate[] {
  const candidates = new Map<string, OfficialWebsiteCandidate>();
  for (const source of sources) {
    if (!isRelevantTavilySource(companyName, source)) continue;
    if (!isPublicHttpUrl(source.url)) continue;
    try {
      const parsed = new URL(source.url);
      const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
      if (
        [...NON_OFFICIAL_HOSTS].some(
          (blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`),
        )
      )
        continue;
      const url = `${parsed.protocol}//${parsed.host}`;
      const existing = candidates.get(url);
      if (existing) existing.sources.push(source);
      else candidates.set(url, { url, source, sources: [source] });
    } catch {
      continue;
    }
  }
  return [...candidates.values()];
}

export function selectOfficialWebsiteCandidate(
  companyName: string,
  sources: WebSource[],
) {
  const candidate = selectOfficialWebsiteCandidates(companyName, sources)[0];
  return candidate ? { source: candidate.source, url: candidate.url } : null;
}

export function verifyOfficialWebsiteEvidence(
  profile: WebsiteVerificationProfile,
  sources: WebSource[],
) {
  const evidence = normalizeCompanyText(
    sources
      .map((source) => `${source.title ?? ""} ${source.content}`)
      .join(" "),
  );
  const addressEvidence = normalizeGermanAddress(evidence);
  const companyStem = companyNameStem(profile.companyName);
  const signals: WebsiteEvidenceSignal[] = [];
  if (companyStem.length >= 5 && evidence.includes(companyStem))
    signals.push("company_name");
  if (profile.city && evidence.includes(normalizeCompanyText(profile.city)))
    signals.push("city");
  if (
    profile.addressLine &&
    addressEvidence.includes(normalizeGermanAddress(profile.addressLine))
  )
    signals.push("street_address");
  if (
    profile.postcode &&
    new RegExp(`(?:^| )${escapeRegExp(profile.postcode)}(?: |$)`).test(evidence)
  )
    signals.push("postcode");
  if (
    profile.representatives?.some((name) => {
      const normalized = normalizeCompanyText(name);
      return normalized.length >= 5 && evidence.includes(normalized);
    })
  )
    signals.push("representative");

  const strongSignals = signals.filter((signal) =>
    ["street_address", "postcode", "representative"].includes(signal),
  );
  return {
    matched: signals.includes("company_name") && strongSignals.length >= 2,
    signals,
  };
}

async function persistWebSources(
  workspaceId: string,
  companyId: string,
  companyName: string,
  sources: WebSource[],
  verifiedWebsite: string | null,
) {
  const rejectionReasons: Record<string, number> = {};
  const accepted = sources.filter((source) => {
    const rejectionReason = webSourceRejectionReason(
      companyName,
      source,
      verifiedWebsite,
    );
    if (!rejectionReason) return true;
    rejectionReasons[rejectionReason] =
      (rejectionReasons[rejectionReason] ?? 0) + 1;
    return false;
  });
  if (!accepted.length)
    return {
      candidateCount: sources.length,
      accepted,
      persisted: [] as Array<{ id: string; url: string }>,
      rejectionReasons,
    };
  const { data, error } = await createAdminClient()
    .from("web_sources")
    .insert(
      accepted.map((source) => ({
        workspace_id: workspaceId,
        company_id: companyId,
        provider: source.provider,
        query: companyName,
        url: source.url,
        title: source.title,
        publication_date: toDate(source.publishedAt),
        result_score: source.score,
        supporting_excerpt: formatSourceExcerpt(source.content),
        retrieved_at: source.retrievedAt,
        raw_payload: source,
      })),
    )
    .select("id,url");
  if (error) throw new Error(error.message);
  return {
    candidateCount: sources.length,
    accepted,
    persisted: data ?? [],
    rejectionReasons,
  };
}

function webSourceRejectionReason(
  companyName: string,
  source: WebSource,
  verifiedWebsite: string | null,
) {
  if (!isPublicHttpUrl(source.url)) return "unsafe_url";
  if (normalizeCompanyText(source.content).length < 80)
    return "too_little_text";
  if (
    source.provider === "tavily" &&
    verifiedWebsite &&
    isSameWebsiteUrl(source.url, verifiedWebsite)
  )
    return "first_party_domain";
  if (
    source.provider === "firecrawl" &&
    verifiedWebsite &&
    !isSameWebsiteUrl(source.url, verifiedWebsite)
  )
    return "off_verified_domain";
  if (
    source.provider === "tavily" &&
    !isRelevantTavilySource(companyName, source, verifiedWebsite)
  )
    return "company_mismatch";
  return null;
}

export function isRelevantTavilySource(
  companyName: string,
  source: WebSource,
  verifiedWebsite?: string | null,
) {
  if (verifiedWebsite && isSameWebsiteUrl(source.url, verifiedWebsite))
    return true;
  const companyStem = companyNameStem(companyName);
  const evidence = normalizeCompanyText(
    `${source.title ?? ""} ${source.content}`,
  );
  if (companyStem.length >= 5 && evidence.includes(companyStem)) return true;
  const brandTokens = companyStem
    .split(" ")
    .filter(
      (token) => token.length >= 5 && !COMPANY_NAME_NOISE_TOKENS.has(token),
    );
  if (!brandTokens.length) return false;
  const matchedTokens = brandTokens.filter((token) => evidence.includes(token));
  return matchedTokens.length >= Math.min(2, brandTokens.length);
}

async function persistWebClaims(
  workspaceId: string,
  companyId: string,
  persistedSources: Array<{ id: string; url: string }>,
  review: ReviewedIntelligence,
) {
  const sourceIdByUrl = new Map(
    persistedSources.map((source) => [source.url, source.id]),
  );
  const rows = review.output.claims.flatMap((claim) => {
    const sourceIds = claim.source_urls.flatMap((url) => {
      const id = sourceIdByUrl.get(url);
      return id ? [id] : [];
    });
    if (sourceIds.length !== claim.source_urls.length) return [];
    return [
      {
        workspace_id: workspaceId,
        company_id: companyId,
        claim_type: claim.type,
        claim_text: claim.claim,
        confidence: claim.confidence,
        source_ids: sourceIds,
        model: review.model,
        prompt_version: review.promptVersion,
        schema_version: review.schemaVersion,
        token_usage: review.usage,
      },
    ];
  });
  if (!rows.length) return 0;
  const supabase = createAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("web_claims")
    .select("claim_type,claim_text")
    .eq("workspace_id", workspaceId)
    .eq("company_id", companyId);
  if (existingError) throw new Error(existingError.message);
  const existingKeys = new Set(
    (existing ?? []).map(
      (claim) => `${claim.claim_type}\u0000${claim.claim_text}`,
    ),
  );
  const newRows = rows.filter(
    (row) => !existingKeys.has(`${row.claim_type}\u0000${row.claim_text}`),
  );
  if (!newRows.length) return 0;
  const { error } = await supabase.from("web_claims").insert(newRows);
  if (error) throw new Error(error.message);
  return newRows.length;
}

const COMPANY_NAME_NOISE_TOKENS = new Set([
  "deutschland",
  "germany",
  "german",
  "holding",
  "gruppe",
  "group",
]);

function formatSourceExcerpt(content: string) {
  return content
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_`>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function normalizeCompanyText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLocaleLowerCase("de")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function companyNameStem(companyName: string) {
  return normalizeCompanyText(
    companyName.replace(
      /\b(?:gmbh|ag|ug|kg|ohg|se|gbr|egbr|haftungsbeschränkt)\b.*$/i,
      "",
    ),
  );
}

function normalizeGermanAddress(value: string) {
  return normalizeCompanyText(value).replace(/\bstr\b/g, "strasse");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildWebsiteVerificationProfile(input: {
  companyName: string;
  city?: string | null;
  addressLine?: string | null;
  postcode?: string | null;
  rawProviderPayload: unknown;
}): WebsiteVerificationProfile {
  const raw = asRecord(input.rawProviderPayload);
  const rawAddress = asRecord(raw.address);
  const representatives = Array.isArray(raw.representation)
    ? raw.representation.flatMap((value) => {
        const name = asText(asRecord(value).name);
        return name ? [name] : [];
      })
    : [];
  return {
    companyName: input.companyName,
    city:
      input.city ?? asText(rawAddress.city) ?? asText(raw.city) ?? undefined,
    addressLine:
      input.addressLine ??
      asText(rawAddress.street) ??
      asText(rawAddress.formatted_value) ??
      asText(raw.address) ??
      undefined,
    postcode:
      input.postcode ??
      asText(rawAddress.postal_code) ??
      asText(rawAddress.postcode) ??
      asText(raw.postcode) ??
      undefined,
    representatives,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 10);
}
