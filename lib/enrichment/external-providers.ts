import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/db/admin";
import { ApolloProvider } from "@/lib/integrations/apollo";
import { ProviderError } from "@/lib/integrations/http";
import { OpenRegisterProvider } from "@/lib/integrations/openregister";
import {
  FirecrawlProvider,
  TavilyProvider,
  type WebSource,
} from "@/lib/integrations/web-research";

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

export async function runExternalProviderEnrichment(input: {
  workspaceId: string;
  companyId: string;
  stage: ExternalProviderStage;
  force?: boolean;
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

async function runWebsiteDiscovery(input: {
  workspaceId: string;
  companyId: string;
  force?: boolean;
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
  if (!company.openregister_company_id)
    throw new Error(
      "This target has no OpenRegister company ID to verify against",
    );
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
  const { data: job, error: jobError } = await supabase
    .from("enrichment_jobs")
    .insert({
      workspace_id: input.workspaceId,
      company_id: input.companyId,
      provider: "tavily",
      job_type: "website_discovery",
      status: "running",
      idempotency_key: `${input.companyId}:website_discovery:${randomUUID()}`,
      payload: { legalName: company.legal_name, city: location?.city ?? null },
      attempt_count: 1,
      estimated_credits: 12,
      started_at: startedAt.toISOString(),
    })
    .select("id")
    .single();
  if (jobError || !job)
    throw new Error(
      jobError?.message ?? "Unable to create website discovery job",
    );

  let lookupAttempted = false;
  let lookupStatus = 200;
  try {
    const sources = await new TavilyProvider().discoverOfficialWebsite({
      companyName: company.legal_name,
      city: location?.city ?? undefined,
    });
    const profile = websiteVerificationProfile({
      companyName: company.legal_name,
      city: location?.city,
      addressLine: location?.address_line,
      postcode: location?.postcode,
      rawProviderPayload: company.raw_provider_payload,
    });
    const candidates = selectOfficialWebsiteCandidates(
      company.legal_name,
      sources,
    );
    const candidate =
      candidates.find(
        (item) => verifyOfficialWebsiteEvidence(profile, item.sources).matched,
      ) ?? candidates[0];
    let verifiedWebsite: string | null = null;
    let verification = "no_verified_match";
    let evidenceSignals: WebsiteEvidenceSignal[] = [];
    let lookupReturnedCompany = false;
    if (candidate) {
      lookupAttempted = true;
      try {
        const match = await new OpenRegisterProvider().lookupCompanyByUrl(
          candidate.url,
        );
        lookupReturnedCompany = true;
        if (match.company_id === company.openregister_company_id) {
          verifiedWebsite = candidate.url;
          verification = "openregister_company_id_match";
        }
      } catch (error) {
        if (error instanceof ProviderError && error.status === 404) {
          lookupStatus = 404;
        } else {
          throw error;
        }
      }
      if (!verifiedWebsite && !lookupReturnedCompany) {
        const evidenceMatch = verifyOfficialWebsiteEvidence(
          profile,
          candidate.sources,
        );
        evidenceSignals = evidenceMatch.signals;
        if (evidenceMatch.matched) {
          verifiedWebsite = candidate.url;
          verification = "openregister_profile_evidence_match";
        }
      }
    }
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
        candidate?.sources ?? [],
      );
    }

    const completedAt = new Date();
    const actualCredits = 2 + (lookupAttempted ? 10 : 0);
    const available = Boolean(verifiedWebsite);
    const usageEvents = [
      {
        workspace_id: input.workspaceId,
        provider: "tavily",
        endpoint: "POST /search (website discovery)",
        enrichment_job_id: job.id,
        estimated_credits: 2,
        actual_credits: 2,
        request_count: 1,
        http_status: 200,
        duration_ms: completedAt.getTime() - startedAt.getTime(),
      },
      ...(lookupAttempted
        ? [
            {
              workspace_id: input.workspaceId,
              provider: "openregister",
              endpoint: "GET /v0/search/lookup",
              enrichment_job_id: job.id,
              estimated_credits: 10,
              actual_credits: 10,
              request_count: 1,
              http_status: lookupStatus,
              duration_ms: completedAt.getTime() - startedAt.getTime(),
            },
          ]
        : []),
    ];
    const [jobResult] = await Promise.all([
      supabase
        .from("enrichment_jobs")
        .update({
          status: "succeeded",
          actual_credits: actualCredits,
          completed_at: completedAt.toISOString(),
          payload: {
            available,
            returned: available ? 1 : 0,
            website: verifiedWebsite,
            verification,
            evidenceSignals,
          },
        })
        .eq("id", job.id)
        .select("id,status,actual_credits,completed_at,payload")
        .single(),
      supabase.from("provider_usage_events").insert(usageEvents),
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
    await Promise.all([
      supabase
        .from("enrichment_jobs")
        .update({
          status: "failed",
          actual_credits: 2 + (lookupAttempted ? 10 : 0),
          completed_at: completedAt.toISOString(),
          error_details: {
            message:
              error instanceof Error
                ? error.message
                : "Website discovery failed",
          },
        })
        .eq("id", job.id),
      supabase.from("provider_usage_events").insert([
        {
          workspace_id: input.workspaceId,
          provider: "tavily",
          endpoint: "POST /search (website discovery)",
          enrichment_job_id: job.id,
          estimated_credits: 2,
          actual_credits: 2,
          request_count: 1,
          http_status: lookupAttempted ? 200 : null,
          duration_ms: completedAt.getTime() - startedAt.getTime(),
        },
        ...(lookupAttempted
          ? [
              {
                workspace_id: input.workspaceId,
                provider: "openregister",
                endpoint: "GET /v0/search/lookup",
                enrichment_job_id: job.id,
                estimated_credits: 10,
                actual_credits: 10,
                request_count: 1,
                http_status:
                  error instanceof ProviderError ? error.status : null,
                duration_ms: completedAt.getTime() - startedAt.getTime(),
              },
            ]
          : []),
      ]),
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
  | "company_name"
  | "city"
  | "street_address"
  | "postcode"
  | "representative";

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
  const companyStem = companyNameStem(companyName);
  const evidence = normalizeCompanyText(
    `${source.title ?? ""} ${source.content}`,
  );
  return companyStem.length >= 5 && evidence.includes(companyStem);
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

function websiteVerificationProfile(input: {
  companyName: string;
  city?: string | null;
  addressLine?: string | null;
  postcode?: string | null;
  rawProviderPayload: unknown;
}): WebsiteVerificationProfile {
  const raw = asRecord(input.rawProviderPayload);
  const representatives = Array.isArray(raw.representation)
    ? raw.representation.flatMap((value) => {
        const name = asText(asRecord(value).name);
        return name ? [name] : [];
      })
    : [];
  return { ...input, representatives };
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
