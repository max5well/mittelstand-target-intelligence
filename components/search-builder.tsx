"use client";

import { useMemo, useState } from "react";
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

export function SearchBuilder() {
  const [open, setOpen] = useState(false);
  const [dailyTarget, setDailyTarget] = useState(40);
  const [mode, setMode] = useState<"lean" | "full" | "custom">("lean");
  const [industryOpen, setIndustryOpen] = useState(false);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([
    "28",
    "26",
  ]);
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
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#13201d] px-4 text-sm font-medium text-white"
      >
        <Plus size={15} /> New saved search
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#101b18]/45"
          role="dialog"
          aria-modal="true"
          aria-label="Create saved search"
        >
          <div className="h-full w-full max-w-[720px] overflow-y-auto bg-[#f8f7f3] shadow-2xl">
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
                    <input defaultValue="German industrial automation" />
                  </Field>
                  <Field label="Description">
                    <input placeholder="Optional investment thesis context" />
                  </Field>
                </div>
              </Section>
              <Section title="Company profile">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Status">
                    <select defaultValue="active">
                      <option value="active">Active companies only</option>
                      <option>Active and inactive</option>
                    </select>
                  </Field>
                  <Field label="Legal forms">
                    <select defaultValue="gmbh-ag">
                      <option value="gmbh-ag">GmbH, AG</option>
                      <option>All supported forms</option>
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
                    <input defaultValue="Germany" />
                  </Field>
                </div>
              </Section>
              <Section title="Size & financials">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Range label="Employees" min="50" max="250" />
                  <Range label="Revenue · EUR" min="10000000" max="80000000" />
                  <Range label="EBITDA · EUR" min="2000000" max="" />
                  <Range
                    label="Incorporated"
                    min="1990-01-01"
                    max="2020-12-31"
                    type="date"
                  />
                </div>
                {advancedFinancials && (
                  <div className="mt-4 grid gap-4 rounded-xl border border-[#d9e4df] bg-[#f2f7f4] p-4 sm:grid-cols-2">
                    <Range label="EBIT · EUR" min="" max="" />
                    <Range label="Equity · EUR" min="" max="" />
                    <Range label="Financial debt · EUR" min="" max="" />
                    <Range label="Balance sheet total · EUR" min="" max="" />
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
                      <input type="checkbox" defaultChecked={index < 3} />
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
                    <input type="time" defaultValue="06:30" />
                  </Field>
                  <Field label="Timezone">
                    <input value="Europe/Berlin" readOnly />
                  </Field>
                </div>
              </Section>
              <div className="rounded-xl border border-[#b8d8ce] bg-[#eaf5f1] p-4">
                <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#24735f]">
                  Plain-language summary
                </p>
                <p className="mt-2 text-sm leading-6">
                  Active German GmbH/AG companies, 50–250 employees, €10m–€80m
                  revenue, €2m+ EBITDA, selected machinery industries,
                  owner-managed or family-owned, no open insolvency.
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
              <button className="flex h-10 items-center gap-2 rounded-lg border border-[#d6d3cb] bg-white px-4 text-xs font-semibold">
                <Search size={14} /> Preview count · 10 credits
              </button>
              <div className="flex gap-2">
                <button className="flex h-10 items-center gap-2 rounded-lg border border-[#d6d3cb] bg-white px-4 text-xs font-semibold">
                  <Save size={14} /> Save draft
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-10 items-center gap-2 rounded-lg bg-[#13201d] px-4 text-xs font-semibold text-white"
                >
                  <CalendarClock size={14} /> Save & activate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
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
  label,
  min,
  max,
  type = "number",
}: {
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
          className="form-control"
          aria-label={`${label} minimum`}
          type={type}
          defaultValue={min}
          placeholder="Minimum"
        />
        <input
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
