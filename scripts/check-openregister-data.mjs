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

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      httpStatus: response.status,
      error: payload?.error?.message ?? payload?.error ?? payload?.message ?? `HTTP ${response.status}`,
      payload: {},
    };
  }
  return { ok: true, httpStatus: response.status, error: null, payload };
}

const headers = { Authorization: `Bearer ${process.env.OPENREGISTER_API_KEY}` };
const autocomplete = await requestJson(
  "https://api.openregister.de/v1/autocomplete/company?query=Siemens%20Mobility%20GmbH",
  { headers },
);
const candidates = autocomplete.payload.results ?? [];
const company =
  candidates.find((candidate) => /^siemens mobility gmbh$/i.test(candidate.name ?? "")) ??
  candidates.find((candidate) => /siemens mobility/i.test(candidate.name ?? "")) ??
  candidates[0];

if (!company?.company_id) {
  console.log(JSON.stringify({ ok: false, error: "No Siemens Mobility GmbH match returned" }, null, 2));
  process.exit(1);
}

const [details, financials, owners] = await Promise.all([
  requestJson(`https://api.openregister.de/v1/company/${encodeURIComponent(company.company_id)}`, { headers }),
  requestJson(`https://api.openregister.de/v1/company/${encodeURIComponent(company.company_id)}/financials`, { headers }),
  requestJson(`https://api.openregister.de/v1/company/${encodeURIComponent(company.company_id)}/owners`, { headers }),
]);

const detailKeys = collectKeys(details.payload);
const financialKeys = collectKeys(financials.payload);
const ownerKeys = collectKeys(owners.payload);
const report = {
  ok: details.ok,
  matchedCompany: company.name,
  details: {
    available: details.ok,
    identity: hasAny(detailKeys, ["name", "legal_form"]) && hasAny(detailKeys, ["register", "register_number"]),
    status: detailKeys.has("status"),
    location: hasAny(detailKeys, ["address", "addresses", "city", "postal_code", "postcode"]),
    management: hasAny(detailKeys, ["management", "managers", "representatives"]),
    industryCodes: hasAny(detailKeys, ["industry_codes", "industry_code"]),
    contactData: hasAny(detailKeys, ["contact", "website_url", "email", "phone"]),
    error: details.error,
  },
  financials: {
    available: financials.ok,
    revenue: financialKeys.has("revenue"),
    ebit: financialKeys.has("ebit"),
    equity: hasAny(financialKeys, ["equity", "shareholders_equity"]),
    debtOrLiabilities: hasAny(financialKeys, ["debt", "liabilities"]),
    totalAssets: hasAny(financialKeys, ["total_assets", "assets"]),
    employees: financialKeys.has("employees"),
    error: financials.error,
  },
  ownership: {
    available: owners.ok,
    owners: ownerKeys.has("owners"),
    ownershipPercent: hasAny(ownerKeys, ["percentage_share", "ownership_percent"]),
    sources: hasAny(ownerKeys, ["sources", "document_url"]),
    directFamilyOwnedFlag: hasAny(ownerKeys, ["family_owned", "family_ownership"]),
    directOwnerManagedFlag: hasAny(ownerKeys, ["owner_managed", "owner_managed_flag"]),
    error: owners.error,
  },
};

console.log(JSON.stringify(report, null, 2));
if (!details.ok) process.exitCode = 1;
