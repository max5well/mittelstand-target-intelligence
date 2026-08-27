import { ArrowUpRight, DatabaseZap, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell";
import { companies, fictionalNotice } from "@/lib/mock-data";
import { formatMoney, formatPercent, statusLabel } from "@/lib/format";

const metrics = [
  {
    label: "Companies tracked",
    value: companies.length.toString(),
    delta: "+7 today",
  },
  {
    label: "Shortlisted",
    value: companies
      .filter((c) => c.status === "shortlisted")
      .length.toString(),
    delta: "8.3% of universe",
  },
  {
    label: "Active dialogue",
    value: companies
      .filter((c) => ["in_conversation", "nda", "diligence"].includes(c.status))
      .length.toString(),
    delta: "+2 this month",
  },
  { label: "Fresh profiles", value: "91%", delta: "within 90 days" },
];

export default function OverviewPage() {
  const targets = companies
    .filter((company) => company.score && company.score >= 78)
    .slice(0, 4);
  return (
    <div className="mx-auto max-w-[1500px] p-5 md:p-9">
      <PageHeader
        eyebrow="Thursday, 27 August"
        title="Your target universe, in focus."
        description="Review new German Mittelstand opportunities, prioritize the best fit, and keep every decision tied to its source."
        action={
          <Link
            href="/searches"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#13201d] px-4 text-sm font-medium text-white"
          >
            <Sparkles size={15} /> Run daily discovery
          </Link>
        }
      />
      <p className="mt-4 rounded-lg border border-[#d9d5cb] bg-[#faf9f6] px-3 py-2 text-[11px] text-[#6a746f]">
        {fictionalNotice}
      </p>
      <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-[#d8d5cc] bg-[#d8d5cc] sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-[#faf9f6] p-5">
            <p className="text-xs font-medium text-[#73807b]">{metric.label}</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">
              {metric.value}
            </p>
            <p className="mt-2 text-xs text-[#28826c]">{metric.delta}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <section className="overflow-hidden rounded-xl border border-[#d8d5cc] bg-[#faf9f6]">
          <div className="flex items-center justify-between border-b border-[#e3e0d8] px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">New high-fit targets</h2>
              <p className="mt-1 text-xs text-[#75807c]">
                From today’s scheduled discovery
              </p>
            </div>
            <Link
              href="/companies"
              className="flex items-center gap-1 text-xs font-semibold text-[#16856b]"
            >
              View all <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="text-[#7c8582]">
                <tr className="border-b border-[#e3e0d8]">
                  {[
                    "Company",
                    "Location",
                    "Revenue",
                    "EBITDA margin",
                    "Status",
                    "Fit",
                  ].map((h) => (
                    <th key={h} className="px-5 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {targets.map((company) => (
                  <tr
                    key={company.id}
                    className="border-b border-[#ebe8e1] last:border-0"
                  >
                    <td className="px-5 py-4 font-medium">
                      <Star
                        size={13}
                        className="mr-3 inline text-[#d2a534]"
                        fill={company.favorite ? "currentColor" : "none"}
                      />
                      <Link
                        href={`/companies/${company.id}`}
                        className="hover:text-[#16856b]"
                      >
                        {company.name}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-[#66716d]">{company.city}</td>
                    <td className="px-5 py-4 font-medium tabular-nums">
                      {formatMoney(company.revenueCents)}
                    </td>
                    <td className="px-5 py-4 font-medium tabular-nums">
                      {formatPercent(
                        company.revenueCents && company.ebitdaCents
                          ? company.ebitdaCents / company.revenueCents
                          : null,
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-[#e8eee9] px-2 py-1 text-[10px] font-semibold text-[#42655c]">
                        {statusLabel(company.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="grid size-8 place-items-center rounded-full border border-[#b9ddd2] font-semibold text-[#16856b]">
                        {company.score}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="rounded-xl border border-[#d8d5cc] bg-[#172521] p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Data readiness</p>
              <p className="mt-1 text-xs text-white/45">
                Across the current universe
              </p>
            </div>
            <DatabaseZap className="text-[#43d4ae]" size={19} />
          </div>
          <div className="mt-8 space-y-5">
            {[
              ["Financial statements", 82],
              ["Ownership records", 71],
              ["Verified websites", 93],
              ["Web intelligence", 46],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <div className="mb-2 flex justify-between text-xs">
                  <span className="text-white/66">{label}</span>
                  <span className="font-medium tabular-nums">{value}%</span>
                </div>
                <div className="h-1.5 rounded bg-white/10">
                  <div
                    className="h-full rounded bg-[#43d4ae]"
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-lg border border-white/10 bg-white/[.04] p-4">
            <p className="text-xs font-semibold">7 records need attention</p>
            <p className="mt-1 text-[11px] leading-5 text-white/46">
              Failed ownership jobs or profiles older than 180 days.
            </p>
            <Link
              href="/jobs"
              className="mt-3 block text-xs font-semibold text-[#65e3c2]"
            >
              Review data issues →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
