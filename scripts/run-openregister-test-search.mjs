import { mkdir, writeFile } from "node:fs/promises";

const query = {
  filters: [
    { field: "status", value: "active" },
    { field: "legal_form", value: "gmbh" },
    { field: "has_open_insolvency", value: "false" },
  ],
  pagination: { page: 1, per_page: 10 },
};

const response = await fetch("https://api.openregister.de/v1/search/company", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENREGISTER_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(query),
});

const payload = await response.json().catch(() => ({}));
if (!response.ok) {
  const message =
    payload?.error?.message ??
    payload?.error ??
    payload?.message ??
    `HTTP ${response.status}`;
  throw new Error(`OpenRegister discovery failed: ${message}`);
}

const na = (value) => (value == null || value === "" ? "N/A" : value);
const companies = (payload.results ?? []).slice(0, 10).map((company) => ({
  openregister_id: na(company.company_id),
  legal_name: na(company.name),
  legal_form: na(company.legal_form),
  register_number: na(company.register_number),
  register_type: na(company.register_type),
  register_court: na(company.register_court),
  active: company.active == null ? "N/A" : company.active,
  city: "N/A",
  revenue: "N/A",
  ebit: "N/A",
  equity: "N/A",
  liabilities: "N/A",
  employees: "N/A",
  ownership: "N/A",
  website: "N/A",
}));

await mkdir("outputs", { recursive: true });
const run = {
  provider: "OpenRegister",
  endpoint: "POST /v1/search/company",
  run_at: new Date().toISOString(),
  query,
  pagination: payload.pagination ?? {},
  companies,
};
await writeFile(
  "outputs/openregister-test-run.json",
  `${JSON.stringify(run, null, 2)}\n`,
  "utf8",
);

const columns = Object.keys(companies[0] ?? {});
const csvCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
const csv = [
  columns.map(csvCell).join(","),
  ...companies.map((company) =>
    columns.map((column) => csvCell(company[column])).join(","),
  ),
].join("\n");
await writeFile("outputs/openregister-test-run.csv", `${csv}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: companies.length === 10,
      httpStatus: response.status,
      requested: 10,
      received: companies.length,
      totalAvailable:
        payload.pagination?.total_results ?? payload.pagination?.total ?? "N/A",
      companies: companies.map(
        ({
          openregister_id,
          legal_name,
          legal_form,
          register_number,
          register_court,
        }) => ({
          openregister_id,
          legal_name,
          legal_form,
          register_number,
          register_court,
        }),
      ),
      saved: [
        "outputs/openregister-test-run.json",
        "outputs/openregister-test-run.csv",
      ],
    },
    null,
    2,
  ),
);

if (companies.length !== 10) process.exitCode = 1;
