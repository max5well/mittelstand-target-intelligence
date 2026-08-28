import { createClient } from "@supabase/supabase-js";

const workspaceId = "00000000-0000-4000-8000-000000000010";
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY;

if (!apiUrl || !serviceKey) {
  throw new Error("Local Supabase server credentials are not configured");
}

const supabase = createClient(apiUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const requiredKeys = [
  "OPENREGISTER_API_KEY",
  "APOLLO_API_KEY",
  "TAVILY_API_KEY",
  "FIRECRAWL_API_KEY",
];
for (const key of requiredKeys) {
  if (!process.env[key]) throw new Error(`${key} is not configured`);
}

async function checkedRequest(provider, endpoint, estimatedCredits, request, summarize) {
  const startedAt = Date.now();
  let response;
  let payload;
  let errorMessage = null;

  try {
    response = await fetch(request.url, request.options);
    const body = await response.text();
    try {
      payload = body ? JSON.parse(body) : {};
    } catch {
      payload = { text: body.slice(0, 500) };
    }
    if (!response.ok) {
      errorMessage =
        payload?.error?.message ?? payload?.error ?? payload?.message ?? `HTTP ${response.status}`;
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Network request failed";
  }

  const durationMs = Date.now() - startedAt;
  const httpStatus = response?.status ?? 0;
  const { error: insertError } = await supabase.from("provider_usage_events").insert({
    workspace_id: workspaceId,
    provider,
    endpoint,
    estimated_credits: estimatedCredits,
    actual_credits: response?.ok ? estimatedCredits : 0,
    request_count: 1,
    http_status: httpStatus,
    duration_ms: durationMs,
  });
  if (insertError) throw new Error(`Unable to record ${provider} verification: ${insertError.message}`);

  const summary = response?.ok ? summarize(payload) : null;
  return {
    provider,
    endpoint,
    ok: Boolean(response?.ok),
    httpStatus,
    durationMs,
    summary,
    error: errorMessage,
  };
}

const results = [];

results.push(
  await checkedRequest(
    "openregister",
    "GET /v1/autocomplete/company",
    1,
    {
      url: "https://api.openregister.de/v1/autocomplete/company?query=Siemens%20Aktiengesellschaft",
      options: {
        headers: { Authorization: `Bearer ${process.env.OPENREGISTER_API_KEY}` },
      },
    },
    (payload) => ({ matches: Array.isArray(payload.results) ? payload.results.length : 0 }),
  ),
);

results.push(
  await checkedRequest(
    "apollo",
    "GET /api/v1/organizations/enrich",
    1,
    {
      url: "https://api.apollo.io/api/v1/organizations/enrich?domain=siemens.com&name=Siemens",
      options: {
        headers: { accept: "application/json", "x-api-key": process.env.APOLLO_API_KEY },
      },
    },
    (payload) => ({ matched: Boolean(payload.organization?.id), name: payload.organization?.name ?? null }),
  ),
);

results.push(
  await checkedRequest(
    "tavily",
    "POST /search",
    1,
    {
      url: "https://api.tavily.com/search",
      options: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: "Siemens AG Germany company official website",
          search_depth: "basic",
          max_results: 3,
          include_answer: false,
        }),
      },
    },
    (payload) => ({ results: Array.isArray(payload.results) ? payload.results.length : 0 }),
  ),
);

results.push(
  await checkedRequest(
    "firecrawl",
    "POST /v2/scrape",
    1,
    {
      url: "https://api.firecrawl.dev/v2/scrape",
      options: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://www.siemens.com/global/en.html",
          formats: ["markdown"],
          onlyMainContent: true,
          timeout: 30000,
        }),
      },
    },
    (payload) => ({
      scraped: payload.success === true,
      title: payload.data?.metadata?.title ?? null,
    }),
  ),
);

const passed = results.filter((result) => result.ok).length;
console.log(JSON.stringify({ passed, total: results.length, results }, null, 2));
if (passed !== results.length) process.exitCode = 1;
