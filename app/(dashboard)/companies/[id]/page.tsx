import { ArrowLeft, Building2, ExternalLink, History, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { getCompanyById } from "@/lib/data/companies";
import { listJobs } from "@/lib/data/jobs";
import { formatMoney, formatPercent, statusLabel } from "@/lib/format";
import { getIntegrationStatuses } from "@/lib/integrations/status";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const company = await getCompanyById(user.workspaceId, id);
  if (!company) notFound();
  const jobs = await listJobs(user.workspaceId, company.id);
  const readyProviders = getIntegrationStatuses().filter((provider) => provider.usable);
  const margin = company.revenueCents && company.ebitdaCents ? company.ebitdaCents / company.revenueCents : null;

  return (
    <div className="mx-auto max-w-[1400px] p-5 md:p-9">
      <Link href="/companies" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-[#5e6b66]"><ArrowLeft size={15} /> Back to companies</Link>
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#dcebe5] text-[#176f5b]"><Building2 size={22} /></span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.1em] text-[#16856b]">{company.openregisterCompanyId}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-.035em]">{company.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[#69736f]">
            <span>{company.postcode} {company.city}, {company.state}</span>
            {company.website && <a href={company.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#087b62]">Website <ExternalLink size={12} /></a>}
            <span className="rounded-full bg-[#e6eee9] px-2.5 py-1 font-semibold text-[#41665c]">{statusLabel(company.status)}</span>
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Revenue", formatMoney(company.revenueCents), company.fiscalYear ? `Reported · FY ${company.fiscalYear}` : "Not reported"],
          ["EBITDA", formatMoney(company.ebitdaCents), company.ebitdaCents ? `${formatPercent(margin)} margin` : "Not reported"],
          ["Employees", company.employees?.toLocaleString() ?? "—", company.employeeYear ? `Reported · ${company.employeeYear}` : "Not reported"],
          ["Ownership", company.ownership, company.ownershipConfidence ? `${Math.round(company.ownershipConfidence * 100)}% confidence` : "Not classified"],
          ["Investment fit", company.score?.toString() ?? "—", company.score ? "Versioned model result" : "No active score"],
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
            <p className="text-sm text-[#75807c]">{label}</p><p className="mt-3 truncate text-xl font-semibold tabular-nums">{value}</p><p className="mt-2 text-xs text-[#7a8580]">{note}</p>
          </div>
        ))}
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-6">
          <h2 className="text-base font-semibold">Current profile</h2>
          <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Field label="Legal form" value={company.legalForm} />
            <Field label="WZ2025 industry" value={`${company.industryCode} · ${company.industry}`} />
            <Field label="Ownership" value={company.ownership} />
            <Field label="Ownership method" value={company.ownershipMethod.replaceAll("_", " ")} />
            <Field label="Profile updated" value={new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(company.updatedAt))} />
            <Field label="Data classification" value={company.sourceType === "reported" ? "Reported source data" : "Estimate"} />
          </dl>
        </section>

        <aside className="space-y-5">
          <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
            <div className="flex items-center gap-2"><ShieldCheck size={17} className="text-[#16856b]" /><h2 className="text-base font-semibold">Available actions</h2></div>
            {readyProviders.length === 0 ? (
              <><p className="mt-3 text-sm leading-6 text-[#68736e]">No provider action is shown because no source is fully configured and verified for this deployment.</p><Link href="/settings?section=integrations" className="mt-4 inline-flex text-sm font-semibold text-[#087b62]">Review integrations →</Link></>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[#68736e]">Provider connections are ready. Actions will appear here only after their persistence flow passes the live verification run.</p>
            )}
          </section>

          <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
            <div className="flex items-center gap-2"><History size={17} className="text-[#16856b]" /><h2 className="text-base font-semibold">Run history</h2></div>
            <p className="mt-2 text-sm leading-6 text-[#68736e]">Completed runs update normalized company records and preserve raw source evidence. Full operational history is also available under Jobs & usage.</p>
            {jobs.length ? <div className="mt-5 divide-y divide-[#e3e0d8]">{jobs.map((job) => <div key={job.id} className="py-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{job.type}</p><span className="text-xs font-semibold capitalize text-[#42645b]">{job.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-xs text-[#7b8581]">{job.provider} · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(job.createdAt))}</p></div>)}</div> : <p className="mt-4 rounded-lg bg-[#f0eee9] p-3 text-sm text-[#68736e]">No provider run has been recorded for this company.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-[.08em] text-[#75807c]">{label}</dt><dd className="mt-2 text-sm leading-6 text-[#28332f]">{value}</dd></div>;
}
