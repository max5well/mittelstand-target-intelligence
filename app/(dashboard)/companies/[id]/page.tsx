import {
  ArrowLeft,
  Building2,
  ExternalLink,
  History,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyActions } from "@/components/company-actions";
import { requireUser } from "@/lib/auth/user";
import { getCompanyById } from "@/lib/data/companies";
import { getCompanyEnrichmentEvidence } from "@/lib/data/enrichment";
import { listJobs } from "@/lib/data/jobs";
import { formatMoney, formatPercent, statusLabel } from "@/lib/format";
import { getIntegrationStatuses } from "@/lib/integrations/status";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const company = await getCompanyById(user.workspaceId, id);
  if (!company) notFound();
  const [jobs, enrichment] = await Promise.all([
    listJobs(user.workspaceId, company.id),
    getCompanyEnrichmentEvidence(user.workspaceId, company.id),
  ]);
  const readyProviders = getIntegrationStatuses().filter(
    (provider) => provider.usable,
  );
  const margin =
    company.revenueCents && company.ebitdaCents
      ? company.ebitdaCents / company.revenueCents
      : null;
  const previousRuns = Array.from(
    jobs.reduce((latest, job) => {
      if (
        [
          "details",
          "financials",
          "owners",
          "website_discovery",
          "apollo_organization",
          "firecrawl_website",
          "tavily_research",
        ].includes(job.type) &&
        job.status === "succeeded" &&
        !latest.has(job.type)
      )
        latest.set(job.type, {
          stage: job.type as
            | "details"
            | "financials"
            | "owners"
            | "website_discovery"
            | "apollo_organization"
            | "firecrawl_website"
            | "tavily_research",
          provider: job.provider,
          completedAt: job.completedAt,
          available: job.available !== false,
        });
      return latest;
    }, new Map<string, { stage: "details" | "financials" | "owners" | "website_discovery" | "apollo_organization" | "firecrawl_website" | "tavily_research"; provider: string; completedAt: string | null; available: boolean }>()),
  ).map(([, run]) => run);

  return (
    <div className="mx-auto max-w-[1400px] p-5 md:p-9">
      <Link
        href="/companies"
        className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-[#5e6b66]"
      >
        <ArrowLeft size={15} /> Back to companies
      </Link>
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#dcebe5] text-[#176f5b]">
          <Building2 size={22} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.1em] text-[#16856b]">
            {company.registerReference} · {company.registerCourt}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-.035em]">
            {company.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[#69736f]">
            <span>
              {[company.address, company.postcode, company.city, company.state]
                .filter((value) => value !== "N/A")
                .join(", ") || "Location N/A"}
            </span>
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#087b62]"
              >
                Website <ExternalLink size={12} />
              </a>
            )}
            <span className="rounded-full bg-[#e6eee9] px-2.5 py-1 font-semibold text-[#41665c]">
              {statusLabel(company.status)}
            </span>
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [
            "Revenue",
            formatMoney(company.revenueCents),
            company.fiscalYear
              ? `Reported · FY ${company.fiscalYear}`
              : "Not reported",
          ],
          [
            "EBITDA",
            formatMoney(company.ebitdaCents),
            company.ebitdaCents
              ? `${formatPercent(margin)} margin`
              : "Not reported",
          ],
          [
            "Employees",
            company.employees?.toLocaleString() ?? "—",
            company.employeeYear
              ? `Reported · ${company.employeeYear}`
              : "Not reported",
          ],
          [
            "Ownership",
            company.ownership,
            company.ownership === "Unknown"
              ? "Not classified"
              : company.owners.length
                ? `${company.owners.length} direct owner record${company.owners.length === 1 ? "" : "s"}`
                : "Rule-based classification; owners not verified",
          ],
          [
            "Investment fit",
            company.score?.toString() ?? "—",
            company.score ? "Versioned model result" : "No active score",
          ],
        ].map(([label, value, note]) => (
          <div
            key={label}
            className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5"
          >
            <p className="text-sm text-[#75807c]">{label}</p>
            <p className="mt-3 truncate text-xl font-semibold tabular-nums">
              {value}
            </p>
            <p className="mt-2 text-xs text-[#7a8580]">{note}</p>
          </div>
        ))}
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-6">
          <h2 className="text-base font-semibold">Current profile</h2>
          <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Field label="Legal form" value={company.legalForm} />
            <Field
              label="Register reference"
              value={company.registerReference}
            />
            <Field label="Register court" value={company.registerCourt} />
            <Field label="Industry" value={company.industry} />
            <Field
              label="Incorporated"
              value={
                company.incorporationDate
                  ? new Intl.DateTimeFormat("en-GB", {
                      dateStyle: "medium",
                    }).format(new Date(company.incorporationDate))
                  : "N/A"
              }
            />
            <Field
              label="Registered capital"
              value={formatMoney(company.capitalCents)}
            />
            <Field label="Ownership" value={company.ownership} />
            <Field
              label="Ownership basis"
              value={
                company.ownershipMethod === "rules"
                  ? "Rule-based inference"
                  : company.ownershipMethod === "openregister_flag"
                    ? "OpenRegister classification"
                    : company.ownershipMethod === "ai_with_evidence"
                      ? "Evidence-based classification"
                      : "Analyst classification"
              }
            />
            <Field
              label="Profile updated"
              value={new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Europe/Berlin",
              }).format(new Date(company.updatedAt))}
            />
            <Field
              label="Data classification"
              value={
                company.sourceType === "reported"
                  ? "Reported source data"
                  : "Estimate"
              }
            />
          </dl>
          <div className="mt-7 border-t border-[#e1ded6] pt-6">
            <h3 className="text-sm font-semibold">Business purpose</h3>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-[#4f5d58]">
              {company.purpose}
            </p>
          </div>
          <div className="mt-7 grid gap-6 border-t border-[#e1ded6] pt-6 md:grid-cols-2">
            <ProfileList
              title="Management"
              empty="N/A"
              rows={company.management.map(
                (person) => `${person.name} · ${person.role}`,
              )}
            />
            <ProfileList
              title="Owners"
              empty="N/A"
              rows={company.owners.map(
                (owner) =>
                  `${owner.name}${owner.percentage === null ? "" : ` · ${owner.percentage}%`}`,
              )}
            />
          </div>
          <div className="mt-7 border-t border-[#e1ded6] pt-6">
            <h3 className="text-sm font-semibold">Provider enrichment</h3>
            {enrichment.apollo || enrichment.webSources.length ? (
              <div className="mt-4 space-y-4">
                {enrichment.apollo ? (
                  <div className="rounded-lg border border-[#e0ddd5] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[.08em] text-[#75807c]">
                      Apollo · estimated data
                    </p>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                      <p>
                        <span className="block text-xs text-[#7a8580]">
                          Employees
                        </span>
                        {enrichment.apollo.estimated_employees ?? "N/A"}
                      </p>
                      <p>
                        <span className="block text-xs text-[#7a8580]">
                          Revenue
                        </span>
                        {formatMoney(enrichment.apollo.estimated_revenue_cents)}
                      </p>
                      <p>
                        <span className="block text-xs text-[#7a8580]">
                          Domain
                        </span>
                        {enrichment.apollo.domain ?? "N/A"}
                      </p>
                    </div>
                  </div>
                ) : null}
                {enrichment.webSources.map((source) => (
                  <article
                    key={source.id}
                    className="rounded-lg border border-[#e0ddd5] bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[.08em] text-[#75807c]">
                        {source.provider} · source evidence
                      </p>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#087b62]"
                      >
                        Open source <ExternalLink size={11} />
                      </a>
                    </div>
                    <p className="mt-2 text-sm font-semibold">
                      {source.title ?? source.url}
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#68736e]">
                      {source.supporting_excerpt || "No text excerpt returned."}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#7a8580]">
                No Apollo, Tavily, or Firecrawl result has been saved for this
                company yet.
              </p>
            )}
          </div>
          <div className="mt-7 grid gap-4 border-t border-[#e1ded6] pt-6 sm:grid-cols-2 xl:grid-cols-4">
            <FinancialField label="EBIT" value={company.ebitCents} />
            <FinancialField label="Equity" value={company.equityCents} />
            <FinancialField label="Financial debt" value={company.debtCents} />
            <FinancialField
              label="Balance sheet total"
              value={company.totalAssetsCents}
            />
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} className="text-[#16856b]" />
              <h2 className="text-base font-semibold">Available actions</h2>
            </div>
            {readyProviders.length === 0 ? (
              <>
                <p className="mt-3 text-sm leading-6 text-[#68736e]">
                  No provider action is shown because no source is fully
                  configured and verified for this deployment.
                </p>
                <Link
                  href="/settings?section=integrations"
                  className="mt-4 inline-flex text-sm font-semibold text-[#087b62]"
                >
                  Review integrations →
                </Link>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6 text-[#68736e]">
                  Each action writes normalized fields, raw source evidence,
                  credits, and its completion time. Previous runs stay visible
                  before you spend credits again.
                </p>
                <CompanyActions
                  companyId={company.id}
                  previousRuns={previousRuns}
                  availableProviders={readyProviders.map(
                    (provider) => provider.id,
                  )}
                  hasWebsite={Boolean(company.website)}
                />
              </>
            )}
          </section>

          <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
            <div className="flex items-center gap-2">
              <History size={17} className="text-[#16856b]" />
              <h2 className="text-base font-semibold">Run history</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#68736e]">
              Completed runs update normalized company records and preserve raw
              source evidence. Full operational history is also available under
              Jobs & usage.
            </p>
            {jobs.length ? (
              <div className="mt-5 divide-y divide-[#e3e0d8]">
                {jobs.map((job) => (
                  <div key={job.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{job.type}</p>
                      <span className="text-xs font-semibold capitalize text-[#42645b]">
                        {job.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#7b8581]">
                      {job.provider} ·{" "}
                      {new Intl.DateTimeFormat("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(job.createdAt))}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-[#f0eee9] p-3 text-sm text-[#68736e]">
                No provider run has been recorded for this company.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[.08em] text-[#75807c]">
        {label}
      </dt>
      <dd className="mt-2 text-sm leading-6 text-[#28332f]">{value}</dd>
    </div>
  );
}

function ProfileList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: string[];
  empty: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length ? (
        <ul className="mt-2 space-y-2 text-sm leading-6 text-[#4f5d58]">
          {rows.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-[#7a8580]">{empty}</p>
      )}
    </div>
  );
}

function FinancialField({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="rounded-lg bg-[#f0eee9] p-3">
      <p className="text-xs text-[#75807c]">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">
        {formatMoney(value)}
      </p>
    </div>
  );
}
