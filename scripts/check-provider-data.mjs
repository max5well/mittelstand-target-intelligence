function collectKeys(value, keys = new Set(), depth = 0) {
  if (depth > 8 || value == null) return keys;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 3)) collectKeys(item, keys, depth + 1);
    return keys;
  }
  if (typeof value !== "object") return keys;
  for (const [key, child] of Object.entries(value)) {
    keys.add(key.toLowerCase());
    collectKeys(child, keys, depth + 1);
  }
  return keys;
}

function hasAny(keys, candidates) {
  return candidates.some((candidate) => keys.has(candidate));
}

async function requestJson(url, options, provider) {
  const startedAt = Date.now();
  const response = await fetch(url, options);
  const body = await response.text();
  let payload = {};
  try {
    payload = body ? JSON.parse(body) : {};
  } catch {
    payload = { text: body.slice(0, 500) };
  }
  if (!response.ok) {
    const message =
      payload?.error?.message ??
      payload?.error ??
      payload?.message ??
      `HTTP ${response.status}`;
    throw new Error(`${provider}: ${message}`);
  }
  return {
    payload,
    durationMs: Date.now() - startedAt,
    httpStatus: response.status,
  };
}

const report = {};

try {
  const headers = {
    Authorization: `Bearer ${process.env.OPENREGISTER_API_KEY}`,
  };
  const autocomplete = await requestJson(
    "https://api.openregister.de/v1/autocomplete/company?query=Siemens%20Aktiengesellschaft",
    { headers },
    "OpenRegister autocomplete",
  );
  const candidates = autocomplete.payload.results ?? [];
  const company =
    candidates.find((candidate) =>
      /siemens aktiengesellschaft/i.test(candidate.name ?? ""),
    ) ??
    candidates.find((candidate) => /siemens/i.test(candidate.name ?? "")) ??
    candidates[0];
  if (!company?.company_id)
    throw new Error("OpenRegister returned no usable Siemens company ID");

  const [details, financials, owners] = await Promise.all([
    requestJson(
      `https://api.openregister.de/v1/company/${encodeURIComponent(company.company_id)}`,
      { headers },
      "OpenRegister company details",
    ),
    requestJson(
      `https://api.openregister.de/v1/company/${encodeURIComponent(company.company_id)}/financials`,
      { headers },
      "OpenRegister financials",
    ),
    requestJson(
      `https://api.openregister.de/v1/company/${encodeURIComponent(company.company_id)}/owners?best_available=true`,
      { headers },
      "OpenRegister owners",
    ),
  ]);
  const detailKeys = collectKeys(details.payload);
  const financialKeys = collectKeys(financials.payload);
  const ownerKeys = collectKeys(owners.payload);
  report.openregister = {
    ok: true,
    companyMatched: Boolean(company.company_id),
    identity:
      hasAny(detailKeys, ["name", "legal_form"]) &&
      hasAny(detailKeys, ["register", "register_number"]),
    status: detailKeys.has("status"),
    locations: hasAny(detailKeys, [
      "address",
      "addresses",
      "city",
      "postal_code",
      "postcode",
    ]),
    management: hasAny(detailKeys, [
      "management",
      "managers",
      "representatives",
    ]),
    industryCodes: hasAny(detailKeys, ["industry_codes", "industry_code"]),
    contactData: hasAny(detailKeys, [
      "contact",
      "website_url",
      "email",
      "phone",
    ]),
    revenue: financialKeys.has("revenue"),
    ebit: financialKeys.has("ebit"),
    equity: hasAny(financialKeys, ["equity", "shareholders_equity"]),
    debtOrLiabilities: hasAny(financialKeys, ["debt", "liabilities"]),
    totalAssets: hasAny(financialKeys, ["total_assets", "assets"]),
    employees: financialKeys.has("employees"),
    owners: ownerKeys.has("owners"),
    ownershipPercent: hasAny(ownerKeys, [
      "percentage_share",
      "ownership_percent",
    ]),
    ownershipSources: hasAny(ownerKeys, ["sources", "document_url"]),
    directFamilyOwnedFlag: hasAny(ownerKeys, [
      "family_owned",
      "family_ownership",
    ]),
    directOwnerManagedFlag: hasAny(ownerKeys, [
      "owner_managed",
      "owner_managed_flag",
    ]),
  };
} catch (error) {
  report.openregister = {
    ok: false,
    error: error instanceof Error ? error.message : "Unknown error",
  };
}

try {
  const apollo = await requestJson(
    "https://api.apollo.io/api/v1/organizations/enrich?domain=siemens.com&name=Siemens",
    {
      headers: {
        accept: "application/json",
        "x-api-key": process.env.APOLLO_API_KEY,
      },
    },
    "Apollo organization enrichment",
  );
  const organization = apollo.payload.organization ?? {};
  const keys = collectKeys(organization);
  report.apollo = {
    ok: true,
    organizationMatched: Boolean(organization.id),
    domain: hasAny(keys, ["primary_domain", "domain", "website_url"]),
    employeeEstimate: hasAny(keys, [
      "estimated_num_employees",
      "employee_count",
    ]),
    revenueEstimate: hasAny(keys, [
      "estimated_annual_revenue",
      "annual_revenue",
    ]),
    industry: hasAny(keys, ["industry", "industries"]),
    location: hasAny(keys, ["country", "city", "state", "street_address"]),
    corporateHierarchy: hasAny(keys, [
      "owned_by_organization",
      "owned_by_chain",
      "ultimate_parent_organization",
      "suborganizations",
    ]),
  };
} catch (error) {
  report.apollo = {
    ok: false,
    error: error instanceof Error ? error.message : "Unknown error",
  };
}

try {
  const tavily = await requestJson(
    "https://api.tavily.com/search",
    {
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
    "Tavily search",
  );
  const results = tavily.payload.results ?? [];
  const keys = collectKeys(results);
  report.tavily = {
    ok: true,
    resultCount: results.length,
    sourceUrls: keys.has("url"),
    titles: keys.has("title"),
    excerpts: keys.has("content"),
    relevanceScores: keys.has("score"),
  };
} catch (error) {
  report.tavily = {
    ok: false,
    error: error instanceof Error ? error.message : "Unknown error",
  };
}

try {
  const firecrawl = await requestJson(
    "https://api.firecrawl.dev/v2/scrape",
    {
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
    "Firecrawl scrape",
  );
  const data = firecrawl.payload.data ?? {};
  report.firecrawl = {
    ok: firecrawl.payload.success === true,
    markdown: typeof data.markdown === "string" && data.markdown.length > 0,
    contentLength: typeof data.markdown === "string" ? data.markdown.length : 0,
    sourceUrl: Boolean(data.metadata?.sourceURL ?? data.metadata?.url),
    title: Boolean(data.metadata?.title),
    statusCode: data.metadata?.statusCode ?? null,
  };
} catch (error) {
  report.firecrawl = {
    ok: false,
    error: error instanceof Error ? error.message : "Unknown error",
  };
}

const passed = Object.values(report).filter((result) => result.ok).length;
console.log(JSON.stringify({ passed, total: 4, report }, null, 2));
if (passed !== 4) process.exitCode = 1;
