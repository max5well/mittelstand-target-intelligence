"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  CalendarClock,
  Check,
  ChevronDown,
  CirclePause,
  LoaderCircle,
  Play,
  Plus,
  Save,
  Search,
} from "lucide-react";
import { germanStates, registerCourtsForStates } from "@/lib/german-states";
import { wz2025Industries } from "@/lib/wz2025";

const providerCosts = { search: 10, details: 10, financials: 10, owners: 10 };

type SearchApiResponse = {
  error?: string;
  pagination?: { total_results?: number; total?: number };
  run?: {
    accepted: number;
    duplicates: number;
    enrichmentCalls: number;
    unavailable: number;
    enrichmentErrors: number;
    creditsUsed: number;
  } | null;
};

export function SearchBuilder() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState<
    "preview" | "save" | "run" | null
  >(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">(
    "info",
  );
  const [dailyTarget, setDailyTarget] = useState(10);
  const [mode, setMode] = useState<"lean" | "full">("full");
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [industryQuery, setIndustryQuery] = useState("");
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
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
      { field: "legal_form", value: String(data.get("legal_form") ?? "gmbh") },
    ];
    const status = String(data.get("status") ?? "active");
    if (status !== "all") filters.unshift({ field: "status", value: status });
    if (selectedIndustries.length)
      filters.push({ field: "industry_codes", values: selectedIndustries });
    const registerCourts = registerCourtsForStates(selectedStates);
    if (registerCourts.length)
      filters.push({ field: "register_court", values: registerCourts });

    const ranges = [
      ["employees", "plain"],
      ["revenue", "money"],
      ["ebitda", "money"],
      ["incorporated_at", "date"],
      ["ebit", "money"],
      ["equity", "money"],
      ["financial_debt", "money"],
      ["balance_sheet_total", "money"],
    ] as const;
    for (const [field, conversion] of ranges) {
      const rawMin = String(data.get(`${field}_min`) ?? "").trim();
      const rawMax = String(data.get(`${field}_max`) ?? "").trim();
      const convert = (value: string) => {
        if (conversion === "money" && value)
          return String(Math.round(Number(value) * 100));
        if (conversion === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          const [year, month, day] = value.split("-");
          return `${day}-${month}-${year}`;
        }
        return value;
      };
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
      ? ` in ${selectedIndustries
          .map(
            (code) =>
              wz2025Industries.find((industry) => industry.code === code)?.name,
          )
          .filter(Boolean)
          .join(", ")}`
      : " across all industries";
    const stateSummary = selectedStates.length
      ? `, registered in ${selectedStates.join(", ")}`
      : "";
    return {
      name: String(data.get("name") ?? "").trim(),
      description: String(data.get("description") ?? "").trim(),
      summary: `Active German ${legalForm} companies${industrySummary}${stateSummary}; unavailable fields remain N/A.`,
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
    setActiveAction("preview");
    setMessageTone("info");
    setMessage("Checking the live OpenRegister count…");
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
      const total =
        result.pagination?.total_results ?? result.pagination?.total ?? 0;
      setMessageTone("success");
      setMessage(
        `${Number(total).toLocaleString()} matching companies reported by OpenRegister.`,
      );
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Preview failed");
    } finally {
      setBusy(false);
      setActiveAction(null);
    }
  }

  async function saveSearch(runNow: boolean) {
    const form = formRef.current;
    if (!form?.reportValidity()) return;
    setBusy(true);
    setActiveAction(runNow ? "run" : "save");
    setMessageTone("info");
    setMessage(runNow ? "Running OpenRegister search…" : "Saving search…");
    try {
      const response = await fetch("/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody(runNow)),
      });
      const result = (await response.json()) as SearchApiResponse;
      if (!response.ok)
        throw new Error(result.error ?? "Unable to save search");
      setMessage(
        result.run
          ? `Run complete: ${result.run.accepted} new, ${result.run.duplicates} already present; ${result.run.enrichmentCalls} enrichment calls recorded (${result.run.creditsUsed} credits).`
          : "Search saved as a draft.",
      );
      setMessageTone("success");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessageTone("error");
      setMessage(
        error instanceof Error ? error.message : "Search setup failed",
      );
    } finally {
      setBusy(false);
      setActiveAction(null);
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
          <form
            ref={formRef}
            onSubmit={(event) => event.preventDefault()}
            className="h-full w-full max-w-[720px] overflow-y-auto bg-[#f8f7f3] shadow-2xl"
          >
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
                    <input
                      name="name"
                      defaultValue="German industrial targets"
                      required
                    />
                  </Field>
                  <Field label="Description">
                    <input
                      name="description"
                      placeholder="Optional investment thesis context"
                    />
                  </Field>
                </div>
              </Section>
              <Section title="Company profile">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Status">
                    <select name="status" defaultValue="active">
                      <option value="active">Active companies only</option>
                      <option value="all">Active and inactive</option>
                    </select>
                  </Field>
                  <Field label="Legal forms">
                    <select name="legal_form" defaultValue="gmbh">
                      <option value="gmbh">GmbH</option>
                      <option value="ag">AG</option>
                      <option value="ug">UG (haftungsbeschränkt)</option>
                    </select>
                  </Field>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.1em] text-[#6b7671]">
                      Industries
                    </p>
                    <IndustrySelector
                      query={industryQuery}
                      onQueryChange={setIndustryQuery}
                      selected={selectedIndustries}
                      onSelectedChange={setSelectedIndustries}
                    />
                    <p className="mt-2 text-xs leading-5 text-[#7a8580]">
                      Select industries by name. The required WZ 2025 codes are
                      added behind the scenes.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.1em] text-[#6b7671]">
                      Location
                    </p>
                    <StateSelector
                      selected={selectedStates}
                      onSelectedChange={setSelectedStates}
                    />
                    <p className="mt-2 text-xs leading-5 text-[#7a8580]">
                      Germany is fixed. Selected states are matched through
                      their current register courts.
                    </p>
                  </div>
                </div>
              </Section>
              <Section title="Size & financials">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Range field="employees" label="Employees" min="" max="" />
                  <Range field="revenue" label="Revenue · EUR" min="" max="" />
                  <Range field="ebitda" label="EBITDA · EUR" min="" max="" />
                  <Range
                    field="incorporated_at"
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
                    <Range
                      field="financial_debt"
                      label="Financial debt · EUR"
                      min=""
                      max=""
                    />
                    <Range
                      field="balance_sheet_total"
                      label="Balance sheet total · EUR"
                      min=""
                      max=""
                    />
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
                          {field === "has_open_insolvency"
                            ? " = false"
                            : " = true"}
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
                    </select>
                  </Field>
                  <Field label="Schedule">
                    <input
                      name="schedule_time"
                      type="time"
                      defaultValue="06:30"
                    />
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
                  provider fields remain N/A and are never filled with dummy
                  data.
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
                    <p className="text-xs text-white/45">Per scheduled run</p>
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
              {message ? (
                <p
                  role={messageTone === "error" ? "alert" : "status"}
                  aria-live="polite"
                  className={`w-full rounded-lg border px-4 py-3 text-sm font-medium leading-5 ${
                    messageTone === "error"
                      ? "border-[#e3b9b2] bg-[#f8e9e6] text-[#8b3e35]"
                      : messageTone === "success"
                        ? "border-[#b5d9cd] bg-[#e8f4ef] text-[#286b59]"
                        : "border-[#cfd8d4] bg-[#edf4f1] text-[#42645b]"
                  }`}
                >
                  {message}
                </p>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={previewCount}
                className="flex h-10 items-center gap-2 rounded-lg border border-[#d6d3cb] bg-white px-4 text-xs font-semibold disabled:opacity-50"
              >
                {activeAction === "preview" ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
                {activeAction === "preview"
                  ? "Checking live count…"
                  : "Preview count · 10 credits"}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveSearch(false)}
                  className="flex h-10 items-center gap-2 rounded-lg border border-[#d6d3cb] bg-white px-4 text-xs font-semibold disabled:opacity-50"
                >
                  {activeAction === "save" ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}{" "}
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveSearch(true)}
                  className="flex h-10 items-center gap-2 rounded-lg bg-[#13201d] px-4 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {activeAction === "run" ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <CalendarClock size={14} />
                  )}{" "}
                  Save & run now
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function IndustrySelector({
  query,
  onQueryChange,
  selected,
  onSelectedChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  selected: string[];
  onSelectedChange: (value: string[]) => void;
}) {
  const filteredIndustries = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("en");
    if (!term) return wz2025Industries;
    return wz2025Industries.filter((industry) =>
      industry.name.toLocaleLowerCase("en").includes(term),
    );
  }, [query]);
  const selectedSet = new Set(selected);
  return (
    <details className="group relative mt-2">
      <summary className="form-control flex cursor-pointer list-none items-center justify-between text-sm font-normal normal-case tracking-normal marker:hidden">
        <span className={selected.length ? "text-[#27332f]" : "text-[#7a8580]"}>
          {selected.length
            ? `${selected.length} industr${selected.length === 1 ? "y" : "ies"} selected`
            : "Select industries by name"}
        </span>
        <ChevronDown size={16} className="transition group-open:rotate-180" />
      </summary>
      <div className="absolute z-20 mt-2 w-full min-w-[320px] rounded-xl border border-[#d7d4cc] bg-white p-3 shadow-xl">
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search e.g. electronics, engineering…"
          aria-label="Search industries by name"
          className="form-control"
        />
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-[#ebe8e1]">
          {filteredIndustries.length ? (
            filteredIndustries.map((industry) => {
              const checked = selectedSet.has(industry.code);
              return (
                <label
                  key={industry.code}
                  className="flex cursor-pointer items-start gap-2 border-b border-[#efede7] px-3 py-2.5 text-sm font-normal normal-case leading-5 tracking-normal last:border-0 hover:bg-[#f4f7f5]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      onSelectedChange(
                        checked
                          ? selected.filter((code) => code !== industry.code)
                          : [...selected, industry.code],
                      )
                    }
                    className="mt-0.5"
                  />
                  <span>{industry.name}</span>
                </label>
              );
            })
          ) : (
            <p className="p-4 text-sm text-[#7a8580]">
              No industry name matches that search.
            </p>
          )}
        </div>
        {selected.length ? (
          <button
            type="button"
            onClick={() => onSelectedChange([])}
            className="mt-2 text-xs font-semibold text-[#087b62]"
          >
            Clear selected industries
          </button>
        ) : null}
      </div>
    </details>
  );
}

function StateSelector({
  selected,
  onSelectedChange,
}: {
  selected: string[];
  onSelectedChange: (value: string[]) => void;
}) {
  const selectedSet = new Set(selected);
  return (
    <details className="group relative mt-2">
      <summary className="form-control flex cursor-pointer list-none items-center justify-between text-sm font-normal normal-case tracking-normal marker:hidden">
        <span className={selected.length ? "text-[#27332f]" : "text-[#7a8580]"}>
          {selected.length ? selected.join(", ") : "All German states"}
        </span>
        <ChevronDown
          size={16}
          className="shrink-0 transition group-open:rotate-180"
        />
      </summary>
      <div className="absolute right-0 z-20 mt-2 max-h-72 w-full min-w-[320px] overflow-y-auto rounded-xl border border-[#d7d4cc] bg-white p-2 shadow-xl">
        {germanStates.map((state) => {
          const checked = selectedSet.has(state.name);
          return (
            <label
              key={state.name}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-normal normal-case tracking-normal hover:bg-[#f4f7f5]"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onSelectedChange(
                    checked
                      ? selected.filter((name) => name !== state.name)
                      : [...selected, state.name],
                  )
                }
              />
              <span className="flex-1">{state.name}</span>
              {checked ? <Check size={14} className="text-[#16856b]" /> : null}
            </label>
          );
        })}
      </div>
    </details>
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
