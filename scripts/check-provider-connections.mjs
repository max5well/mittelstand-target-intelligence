const checks = [
  {
    provider: "OpenRegister",
    url: "https://api.openregister.de/v1/autocomplete/company?query=Siemens%20Aktiengesellschaft",
    options: {
      headers: { Authorization: `Bearer ${process.env.OPENREGISTER_API_KEY}` },
    },
    connected: (payload) => Array.isArray(payload.results),
  },
  {
    provider: "Firecrawl",
    url: "https://api.firecrawl.dev/v1/team/credit-usage",
    options: {
      headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` },
    },
    connected: (payload) => payload.success === true,
  },
  {
    provider: "Apollo",
    url: "https://api.apollo.io/api/v1/auth/health",
    options: {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": process.env.APOLLO_API_KEY,
      },
    },
    connected: (payload) =>
      payload.healthy === true && payload.is_logged_in === true,
  },
  {
    provider: "Tavily",
    url: "https://api.tavily.com/usage",
    options: {
      headers: { Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
    },
    connected: (payload) => Boolean(payload.key || payload.account),
  },
];

const results = [];
for (const check of checks) {
  const startedAt = Date.now();
  try {
    const response = await fetch(check.url, check.options);
    const payload = await response.json().catch(() => ({}));
    results.push({
      provider: check.provider,
      connected: response.ok && check.connected(payload),
      httpStatus: response.status,
      durationMs: Date.now() - startedAt,
      error: response.ok
        ? null
        : (payload?.error?.message ??
          payload?.error ??
          payload?.message ??
          `HTTP ${response.status}`),
    });
  } catch (error) {
    results.push({
      provider: check.provider,
      connected: false,
      httpStatus: 0,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Network request failed",
    });
  }
}

const passed = results.filter((result) => result.connected).length;
console.log(
  JSON.stringify({ passed, total: results.length, results }, null, 2),
);
if (passed !== results.length) process.exitCode = 1;
