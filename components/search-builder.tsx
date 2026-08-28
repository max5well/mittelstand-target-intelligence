"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  CalendarClock,
  ChevronDown,
  CirclePause,
  Play,
  Plus,
  Save,
  Search,
} from "lucide-react";

const providerCosts = { search: 10, details: 10, financials: 10, owners: 10 };
const industryOptions = [
  ["28", "Machinery & equipment"],
  ["26", "Electronics & optical products"],
  ["27", "Electrical equipment"],
  ["22", "Rubber & plastic products"],
  ["32.5", "Medical and dental instruments"],
] as const;

type SearchApiResponse = {
  error?: string;
  pagination?: { total_results?: number; total?: number };
  run?: { accepted: number; duplicates: number } | null;
};

export function SearchBuilder() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dailyTarget, setDailyTarget] = useState(40);
  const [mode, setMode] = useState<"lean" | "full" | "custom">("lean");
  const [industryOpen, setIndustryOpen] = useState(false);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [advancedFinancials, setAdvancedFinancials] = useState(false);
  const dailyCost = useMemo(
    () =>
      providerCosts.search +
      dailyTarget *
        (providerCosts.details +
          (mode === "full"
            ? providerCosts.financials + providerCosts.owners
            : 0)),
    [dailyTarget, mode],
  );

  function requestBody(runNow: boolean) {
    const form = formRef.current;
    if (!form) throw new Error("Search form is unavailable");
    const data = new FormData(form);
    const filters: Array<{
      field: string;
      value?: string;
      min?: string;
      max?: string;
      values?: string[];
    }> = [
      { field: "status", value: String(data.get("status") ?? "active") },
      { field: "legal_form", value: String(data.get("legal_form") ?? "gmbh") },
    ];
    if (selectedIndustries.length)
      filters.push({ field: "industry_codes", values: selectedIndustries });

    const ranges = [
      ["employees", false],
      ["revenue", true],
      ["ebitda", true],
      ["incorporation_date", false],
      ["ebit", true],
      ["equity", true],
      ["financial_debt", true],
      ["balance_sheet_total", true],
    ] as const;
    for (const [field, convertEurosToCents] of ranges) {
      const rawMin = String(data.get(`${field}_min`) ?? "").trim();
      const rawMax = String(data.get(`${field}_max`) ?? "").trim();
      const convert = (value: string) =>
        convertEurosToCents && value
          ? String(Math.round(Number(value) * 100))
          : value;
      if (rawMin || rawMax)
        filters.push({
          field,
          ...(rawMin ? { min: convert(rawMin) } : {}),
          ...(rawMax ? { max: convert(rawMax) } : {}),
        });
    }
    for (const field of data.getAll("ownership_filter")) {
      filters.push({
        field: String(field),
        value: field === "has_open_insolvency" ? "false" : "true",
      });
    }
    const legalForm = String(data.get("legal_form") ?? "gmbh").toUpperCase();
    const industrySummary = selectedIndustries.length
      ? ` in WZ2025 ${selectedIndustries.join(", ")}`
      : " across all industries";
    return {
      name: String(data.get("name") ?? "").trim(),
      description: String(data.get("description") ?? "").trim(),
      summary: `Active German ${legalForm} companies${industrySummary}; unavailable fields remain N/A.`,
      filters,
      hydrationMode: mode,
      dailyTarget,
      scheduleTime: String(data.get("schedule_time") ?? "06:30"),
      active: data.get("active") === "on",
      runNow,
    };
  }

  async function previewCount() {
    setBusy(true);
    setMessage("");
    try {
      const body = requestBody(false);
      const response = await fetch("/api/providers/openregister/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: body.filters,
          pagination: { page: 1, per_page: 1 },
        }),
      });
      const result = (await response.json()) as SearchApiResponse;
      if (!response.ok) throw new Error(result.error ?? "Preview failed");
      const total = result.pagination?.total_results ?? result.pagination?.total ?? 0;
      setMessage(`${Number(total).toLocaleString()} matching companies reported by OpenRegister.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveSearch(runNow: boolean) {
    const form = formRef.current;
    if (!form?.reportValidity()) return;
    setBusy(true);
    setMessage(runNow ? "Running OpenRegister search…" : "Saving search…");
    try {
      const response = await fetch("/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody(runNow)),
      });
      const result = (await response.json()) as SearchApiResponse;
      if (!response.ok) throw new Error(result.error ?? "Unable to save search");
      setMessage(
        result.run
          ? `Run complete: ${result.run.accepted} new, ${result.run.duplicates} already in the workspace.`
          : "Search saved as a draft.",
      );
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Search setup failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#13201d] px-4 text-sm font-medium text-white"
      >
        <Plus size={15} /> New saved search
      </button>
      {message && !open && (
        <p className="max-w-sm text-xs leading-5 text-[#4f655e]">{message}</p>
      )}
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#101b18]/45"
          role="dialog"
          aria-modal="true"
          aria-label="Create saved search"
        >
          <form ref={formRef} onSubmit={(event) => event.preventDefault()} className="h-full w-full max-w-[720px] overflow-y-auto bg-[#f8f7f3] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#d9d6ce] bg-[#f8f7f3]/95 px-6 py-5 backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16856b]">
                  Search builder
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  New acquisition search
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-[#d6d3cb] bg-white px-3 py-2 text-xs"
              >
                Close
              </button>
            </div>
            <div className="space-y-6 p-6">
              <Section title="Search identity">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Search name">
                    <input name="name" defaultValue="German industrial targets" required />
                  </Field>
                  <Field label="Description">
                    <input name="description" placeholder="Optional investment thesis context" />
                  </Field>
                </div>
              </Section>
              <Section title="Company profile">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Status">
                    <select name="status" defaultValue="active">
                      <option value="active">Active companies only</option>
                      <option>Active and inactive</option>
                    </select>
                  </Field>
                  <Field label="Legal forms">
                    <select name="legal_form" defaultValue="gmbh">
                      <option value="gmbh">GmbH</option>
                      <option value="ag">AG</option>
                      <option value="ug">UG (haftungsbeschränkt)</option>
                    </select>
                  </Field>
                  <Field label="WZ2025 industries">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIndustryOpen((value) => !value)}
                        aria-expanded={industryOpen}
                        className="form-control flex items-center justify-between text-left"
                      >
                        <span className="truncate">
                          {selectedIndustries.length
                            ? industryOptions
                                .filter(([code]) =>
                                  selectedIndustries.includes(code),
                                )
                                .map(([code, label]) => `${code} · ${label}`)
                                .join(", ")
                            : "Select WZ2025 industries"}
                        </span>
                        <ChevronDown
                          size={13}
                          className={`shrink-0 transition ${industryOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {industryOpen && (
                        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-lg border border-[#d8d5cd] bg-white p-2 shadow-xl">
                          {industryOptions.map(([code, label]) => (
                            <label
                              key={code}
                              className="flex items-center gap-2 rounded px-2 py-2 text-xs normal-case tracking-normal hover:bg-[#f3f2ed]"
                            >
                              <input
                                type="checkbox"
                                checked={selectedIndustries.includes(code)}
                                onChange={() =>
                                  setSelectedIndustries((current) =>
                                    current.includes(code)
                                      ? current.filter((item) => item !== code)
                                      : [...current, code],
                                  )
                                }
                              />
                              <span className="font-mono text-xs text-[#16856b]">
                                {code}
                              </span>
                              <span>{label}</span>
                            </label>
                          ))}
                          <p className="border-t border-[#ece9e2] px-2 pt-2 text-xs normal-case tracking-normal text-[#7a8580]">
                            OpenRegister field: industry_codes · WZ2025
                          </p>
                        </div>
                      )}
                    </div>
                  </Field>
                  <Field label="Location">
                    <input value="Germany" readOnly />
                  </Field>
                </div>
              </Section>
              <Section title="Size & financials">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Range field="employees" label="Employees" min="" max="" />
                  <Range field="revenue" label="Revenue · EUR" min="" max="" />
                  <Range field="ebitda" label="EBITDA · EUR" min="" max="" />
                  <Range
                    field="incorporation_date"
                    label="Incorporated"
                    min=""
                    max=""
                    type="date"
                  />
                </div>
                {advancedFinancials && (
                  <div className="mt-4 grid gap-4 rounded-xl border border-[#d9e4df] bg-[#f2f7f4] p-4 sm:grid-cols-2">
                    <Range field="ebit" label="EBIT · EUR" min="" max="" />
                    <Range field="equity" label="Equity · EUR" min="" max="" />
                    <Range field="financial_debt" label="Financial debt · EUR" min="" max="" />
                    <Range field="balance_sheet_total" label="Balance sheet total · EUR" min="" max="" />
                    <p className="sm:col-span-2 text-xs leading-4 text-[#6f7b76]">
                      Documented OpenRegister range fields: ebit, equity,
                      financial_debt, and balance_sheet_total. EUR inputs are
                      converted to integer cents before the API request.
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setAdvancedFinancials((value) => !value)}
                  aria-expanded={advancedFinancials}
                  className="mt-4 text-xs font-semibold text-[#16856b]"
                >
                  {advancedFinancials ? "− Hide" : "+ Advanced"} financials
                  (EBIT, equity, debt…)
                </button>
              </Section>
              <Section title="Ownership & risk">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Owner-managed", "has_representative_owner", true],
                    ["Family-owned", "is_family_owned", true],
                    ["Exclude open insolvency", "has_open_insolvency", false],
                    ["Sole owner", "has_sole_owner", true],
                  ].map(([label, field, enterprise], index) => (
                    <label
                      key={String(label)}
                      className="flex items-center gap-3 rounded-lg border border-[#dfdcd4] bg-white p-3 text-xs"
                    >
                      <input
                        type="checkbox"
                        name="ownership_filter"
                        value={String(field)}
                        defaultChecked={index === 2}
                      />
                      <span>
                        {label}
                        <span className="mt-0.5 block font-mono text-xs text-[#7a8580]">
                          {field}
                          {field === "has_open_insolvency" ? " = false" : " = true"}
                        </span>
                      </span>
                      {enterprise && (
                        <span className="ml-auto rounded bg-[#fff2c8] px-1.5 py-1 text-xs font-semibold text-[#6f581e]">
                          Enterprise
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </Section>
              <Section title="Hydration & schedule">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Daily target">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={dailyTarget}
                      onChange={(event) =>
                        setDailyTarget(
                          Math.max(
                            1,
                            Math.min(100, Number(event.target.value)),
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Hydration mode">
                    <select
                      value={mode}
                      onChange={(event) =>
                        setMode(event.target.value as typeof mode)
                      }
                    >
                      <option value="lean">Lean · details only</option>
                      <option value="full">
                        Full · details, financials, owners
                      </option>
                      <option value="custom">Custom stages</option>
                    </select>
                  </Field>
                  <Field label="Schedule">
                    <input name="schedule_time" type="time" defaultValue="06:30" />
                  </Field>
                  <Field label="Timezone">
                    <input value="Europe/Berlin" readOnly />
                  </Field>
                </div>
                <label className="mt-4 flex items-center gap-3 rounded-lg border border-[#d9e4df] bg-white p-3 text-xs font-semibold">
                  <input name="active" type="checkbox" />
                  Activate the daily schedule after saving
                </label>
              </Section>
              <div className="rounded-xl border border-[#b8d8ce] bg-[#eaf5f1] p-4">
                <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#24735f]">
                  Plain-language summary
                </p>
                <p className="mt-2 text-sm leading-6">
                  The summary is generated from the filters you select. Missing
                  provider fields remain N/A and are never filled with dummy data.
                </p>
              </div>
              <div className="rounded-xl bg-[#172521] p-5 text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold">
                      Estimated provider usage
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      Configured rates; actual usage is recorded per job.
                    </p>
                  </div>
                  <Calculator size={18} className="text-[#54d5b3]" />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-white/45">
                      Per scheduled run
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {dailyCost.toLocaleString()} cr
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/45">
                      Monthly estimate · 30 days
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {(dailyCost * 30).toLocaleString()} cr
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-4 text-white/45">
                  Preview count is not run automatically. Clicking Preview count
                  spends {providerCosts.search} credits.
                </p>
              </div>
            </div>
            <div className="sticky bottom-0 flex flex-wrap justify-between gap-3 border-t border-[#d9d6ce] bg-[#f8f7f3]/95 px-6 py-4 backdrop-blur">
              <button type="button" disabled={busy} onClick={previewCount} className="flex h-10 items-center gap-2 rounded-lg border border-[#d6d3cb] bg-white px-4 text-xs font-semibold disabled:opacity-50">
                <Search size={14} /> Preview count · 10 credits
              </button>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => saveSearch(false)} className="flex h-10 items-center gap-2 rounded-lg border border-[#d6d3cb] bg-white px-4 text-xs font-semibold disabled:opacity-50">
                  <Save size={14} /> Save draft
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveSearch(true)}
                  className="flex h-10 items-center gap-2 rounded-lg bg-[#13201d] px-4 text-xs font-semibold text-white disabled:opacity-50"
                >
                  <CalendarClock size={14} /> Save & run now
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[.1em] text-[#6b7671]">
      {label}
      <span className="mt-2 block [&_input]:form-control [&_select]:form-control">
        {children}
      </span>
    </label>
  );
}
function Range({
  field,
  label,
  min,
  max,
  type = "number",
}: {
  field: string;
  label: string;
  min: string;
  max: string;
  type?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[.1em] text-[#6b7671]">
        {label}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input
          name={`${field}_min`}
          className="form-control"
          aria-label={`${label} minimum`}
          type={type}
          defaultValue={min}
          placeholder="Minimum"
        />
        <input
          name={`${field}_max`}
          className="form-control"
          aria-label={`${label} maximum`}
          type={type}
          defaultValue={max}
          placeholder="Maximum"
        />
      </div>
    </div>
  );
}

export function SearchCard({
  name,
  summary,
  active,
  lastRun,
  accepted,
}: {
  name: string;
  summary: string;
  active: boolean;
  lastRun: string;
  accepted: number;
}) {
  const [isActive, setIsActive] = useState(active);
  return (
    <article className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{name}</h2>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${isActive ? "bg-[#e0f2ec] text-[#236a58]" : "bg-[#eceae5] text-[#717a76]"}`}
            >
              {isActive ? "Active" : "Paused"}
            </span>
          </div>
          <p className="mt-3 max-w-xl text-xs leading-5 text-[#68736e]">
            {summary}
          </p>
        </div>
        <button
          onClick={() => setIsActive((value) => !value)}
          aria-label={isActive ? "Pause schedule" : "Resume schedule"}
          className="grid size-9 place-items-center rounded-lg border border-[#d7d4cc] bg-white"
        >
          {isActive ? <CirclePause size={15} /> : <Play size={15} />}
        </button>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-4 border-t border-[#e3e0d8] pt-4 text-xs">
        <div>
          <p className="text-[#84908b]">Last run</p>
          <p className="mt-1 font-semibold">{lastRun}</p>
        </div>
        <div>
          <p className="text-[#84908b]">New accepted</p>
          <p className="mt-1 font-semibold tabular-nums">{accepted}</p>
        </div>
        <div>
          <p className="text-[#84908b]">Mode</p>
          <p className="mt-1 font-semibold">Lean · 420 cr/day</p>
        </div>
      </div>
      <button className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#087b62]">
        <Play size={12} /> Run now
      </button>
    </article>
  );
}
