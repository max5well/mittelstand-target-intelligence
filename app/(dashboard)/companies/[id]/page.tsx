import {
  ArrowLeft,
  Building2,
  ExternalLink,
  FileText,
  Globe2,
  RefreshCw,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FinancialChart } from "@/components/financial-chart";
import { formatMoney, formatPercent, statusLabel } from "@/lib/format";
import { getCompany } from "@/lib/mock-data";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = getCompany(id);
  if (!company) notFound();
  const margin =
    company.revenueCents && company.ebitdaCents
      ? company.ebitdaCents / company.revenueCents
      : null;
  const actions = [
    ["Refresh profile", "OpenRegister · 10 credits", RefreshCw],
    ["Fetch financials", "OpenRegister · 10 credits", FileText],
    ["Fetch ownership", "OpenRegister · 10 credits", Users],
    ["Analyze website", "Firecrawl · est. 1 credit", Globe2],
    ["Full enhancement", "Up to 43 credits", Sparkles],
  ] as const;
  return (
    <div className="mx-auto max-w-[1500px] p-5 md:p-9">
      <Link
        href="/companies"
        className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-[#5e6b66]"
      >
        <ArrowLeft size={14} /> Back to companies
      </Link>
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
        <div className="flex gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#dcebe5] text-[#176f5b]">
            <Building2 size={22} />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#16856b]">
              {company.openregisterCompanyId} · fictional fixture
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-.035em]">
              {company.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#69736f]">
              <span>
                {company.postcode} {company.city}, {company.state}
              </span>
              {company.website && (
                <a
                  href={company.website}
                  className="flex items-center gap-1 text-[#087b62]"
                >
                  Website <ExternalLink size={11} />
                </a>
              )}
              <span className="rounded-full bg-[#e6eee9] px-2 py-1 font-semibold text-[#41665c]">
                {statusLabel(company.status)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="grid size-10 place-items-center rounded-lg border border-[#d7d4cc] bg-white text-[#b58b25]">
            <Star size={16} fill={company.favorite ? "currentColor" : "none"} />
          </button>
          {actions.slice(0, 2).map(([label, cost, Icon]) => (
            <button
              key={label}
              title={cost}
              className="flex h-10 items-center gap-2 rounded-lg border border-[#d7d4cc] bg-white px-3 text-xs font-semibold"
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
          <button
            title={actions[4][1]}
            className="flex h-10 items-center gap-2 rounded-lg bg-[#13201d] px-3 text-xs font-semibold text-white"
          >
            <Sparkles size={14} /> Full enhancement
          </button>
        </div>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [
            "Revenue",
            formatMoney(company.revenueCents),
            `Reported · FY ${company.fiscalYear ?? "—"}`,
          ],
          [
            "EBITDA",
            formatMoney(company.ebitdaCents),
            `${formatPercent(margin)} margin`,
          ],
          [
            "Employees",
            company.employees?.toString() ?? "—",
            company.employees
              ? `Reported · ${company.employeeYear}`
              : "Not reported",
          ],
          [
            "Ownership",
            company.ownership,
            `${Math.round(company.ownershipConfidence * 100)}% confidence · inferred`,
          ],
          [
            "Investment fit",
            company.score?.toString() ?? "—",
            company.score ? "Score v1.2 · rules based" : "Insufficient data",
          ],
        ].map(([label, value, note]) => (
          <div
            key={label}
            className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-4"
          >
            <p className="text-[11px] font-medium text-[#75807c]">{label}</p>
            <p className="mt-3 truncate text-xl font-semibold tabular-nums">
              {value}
            </p>
            <p className="mt-2 text-[10px] text-[#7a8580]">{note}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Financials</h2>
                <p className="mt-1 text-xs text-[#75807c]">
                  Reported values; missing periods remain null.
                </p>
              </div>
              <span className="rounded bg-[#e6eee9] px-2 py-1 text-[10px] font-semibold text-[#3c6258]">
                OpenRegister · 27 Aug 2026
              </span>
            </div>
            <FinancialChart />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[600px] text-xs">
                <thead className="text-left text-[#75807c]">
                  <tr>
                    {[
                      "Period",
                      "Revenue",
                      "EBITDA",
                      "EBIT",
                      "Net income",
                      "Employees",
                    ].map((header) => (
                      <th
                        key={header}
                        className="border-b border-[#e1ded6] py-3 font-medium"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["2024", "€54.2m", "€10.0m", "€8.4m", "€5.2m", "191"],
                    ["2023", "€46.7m", "€7.2m", "€5.9m", "€3.8m", "174"],
                    ["2022", "€39.1m", "€5.1m", "€4.0m", "€2.6m", "158"],
                  ].map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell) => (
                        <td
                          key={cell}
                          className="border-b border-[#ebe8e1] py-3 tabular-nums"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
            <h2 className="text-sm font-semibold">Ownership & management</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-[#e1ded6] bg-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#75807c]">
                  Classification
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {company.ownership}
                </p>
                <p className="mt-2 text-xs leading-5 text-[#68736e]">
                  {company.ownerSummary}. Classification method:{" "}
                  {company.ownershipMethod.replaceAll("_", " ")}. This is an
                  application interpretation, not an official register fact.
                </p>
              </div>
              <div className="rounded-lg border border-[#e1ded6] bg-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#75807c]">
                  Management
                </p>
                <p className="mt-2 text-sm font-semibold">Dr. Lena Hartung</p>
                <p className="mt-1 text-xs text-[#68736e]">
                  Managing Director · since 2019
                </p>
                <p className="mt-3 text-sm font-semibold">Martin Keller</p>
                <p className="mt-1 text-xs text-[#68736e]">
                  Managing Director · since 2013
                </p>
              </div>
            </div>
          </section>
          <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-[#16856b]" />
              <h2 className="text-sm font-semibold">Web intelligence</h2>
              <span className="rounded bg-[#fff3cf] px-2 py-1 text-[9px] font-semibold text-[#775f1f]">
                Derived · evidence required
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#53605b]">
              The company manufactures high-precision dosing systems for
              regulated industrial processes, with a focus on medical devices
              and specialty chemicals.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                ["Growth signal", "New production site announced for Q4 2026."],
                [
                  "Succession signal",
                  "Founder remains chair; no transition reported.",
                ],
                ["Risk", "Customer concentration mentioned in 2024 filing."],
              ].map(([title, copy]) => (
                <div
                  key={title}
                  className="rounded-lg border border-[#e1ded6] bg-white p-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#16856b]">
                    {title}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[#5d6864]">
                    {copy}
                  </p>
                  <a
                    href="https://example.com/fictional-evidence"
                    className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#087b62]"
                  >
                    Fictional source <ExternalLink size={9} />
                  </a>
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="space-y-4">
          <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-4">
            <h2 className="text-xs font-semibold">Provider actions</h2>
            <div className="mt-3 space-y-2">
              {actions.map(([label, cost, Icon]) => (
                <button
                  key={label}
                  className="flex w-full items-center justify-between rounded-lg border border-[#e0ddd5] bg-white p-3 text-left"
                >
                  <span className="flex items-center gap-2 text-xs font-medium">
                    <Icon size={13} />
                    {label}
                  </span>
                  <span className="text-[9px] text-[#78827e]">{cost}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-4">
            <h2 className="text-xs font-semibold">Activity</h2>
            <div className="mt-4 space-y-4 border-l border-[#d5d2ca] pl-4">
              {[
                ["Today, 09:42", "Financials refreshed"],
                ["26 Aug, 16:08", "Moved from New to Shortlisted"],
                ["25 Aug, 11:20", "Ownership classified by rules"],
                ["24 Aug, 07:31", "Discovered by Daily Industrials"],
              ].map(([time, event]) => (
                <div key={event}>
                  <p className="text-[10px] text-[#84908b]">{time}</p>
                  <p className="mt-1 text-xs font-medium">{event}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-4">
            <h2 className="text-xs font-semibold">Sources</h2>
            <p className="mt-3 text-xs leading-5 text-[#68736e]">
              OpenRegister company, financials, and owners endpoints; company
              website; external news research. Retrieval dates and raw payload
              references are retained.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
