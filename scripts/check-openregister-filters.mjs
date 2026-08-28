const response = await fetch("https://api.openregister.de/v1/search/company", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENREGISTER_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    filters: [
      { field: "status", value: "active" },
      { field: "legal_form", value: "gmbh" },
      { field: "is_family_owned", value: "true" },
      { field: "has_representative_owner", value: "true" },
      { field: "equity", min: "100000000" },
      { field: "liabilities", max: "10000000000" },
    ],
    pagination: { page: 1, per_page: 1 },
  }),
});

const payload = await response.json().catch(() => ({}));
const report = {
  ok: response.ok,
  httpStatus: response.status,
  enterpriseOwnershipFiltersAccepted: response.ok,
  equityFilterAccepted: response.ok,
  liabilitiesFilterAccepted: response.ok,
  resultCount: Array.isArray(payload.results) ? payload.results.length : 0,
  error: response.ok
    ? null
    : payload?.error?.message ?? payload?.error ?? payload?.message ?? `HTTP ${response.status}`,
};

console.log(JSON.stringify(report, null, 2));
if (!response.ok) process.exitCode = 1;
