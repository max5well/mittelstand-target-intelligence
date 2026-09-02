import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ExternalLink,
  Globe2,
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
import {
  formatMoney,
  formatPercent,
  jobStatusLabel,
  jobTypeLabel,
  ownershipLabel,
  statusLabel,
} from "@/lib/format";
import { getIntegrationStatuses } from "@/lib/integrations/status";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const company = await getCompanyById(user.workspaceId, user.id, id);
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
        <ArrowLeft size={15} /> Zurück zu den Unternehmen
      </Link>
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#dcebe5] text-[#176f5b]">
          <Building2 size={22} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.1em] text-[#13745f]">
            {company.registerReference} · {company.registerCourt}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-.035em]">
            {company.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[#69736f]">
            <span>
              {[company.address, company.postcode, company.city, company.state]
                .filter((value) => value !== "N/A")
                .join(", ") || "Standort N/V"}
            </span>
            <span className="rounded-full bg-[#e6eee9] px-2.5 py-1 font-semibold text-[#41665c]">
              {statusLabel(company.status)}
            </span>
          </div>
          {company.website ? (
            <a
              href={company.website}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex w-fit max-w-full items-center gap-3 rounded-xl border border-[#9bcfbe] bg-[#eaf6f1] px-4 py-3 text-[#155f4e] shadow-sm transition hover:border-[#5eaf95] hover:bg-[#e0f2eb]"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#cce9de]">
                <Globe2 size={18} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[.09em]">
                  <CheckCircle2 size={13} /> Verifizierte Website
                </span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-[#123f35]">
                  {displayWebsiteHost(company.website)}
                </span>
              </span>
              <ExternalLink className="ml-1 shrink-0" size={15} />
            </a>
          ) : null}
        </div>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [
            "Umsatz",
            formatMoney(company.revenueCents),
            company.fiscalYear
              ? `Gemeldet · GJ ${company.fiscalYear}`
              : "Nicht gemeldet",
          ],
          [
            "EBITDA",
            formatMoney(company.ebitdaCents),
            company.ebitdaCents
              ? `${formatPercent(margin)} Marge`
              : "Nicht gemeldet",
          ],
          [
            "Beschäftigte",
            company.employees?.toLocaleString("de-DE") ?? "—",
            company.employeeYear
              ? `Gemeldet · ${company.employeeYear}`
              : "Nicht gemeldet",
          ],
          [
            "Eigentümerstruktur",
            ownershipLabel(company.ownership),
            company.ownership === "Unknown"
              ? "Nicht klassifiziert"
              : company.owners.length
                ? `${company.owners.length} direkte${company.owners.length === 1 ? "r Eigentümereintrag" : " Eigentümereinträge"}`
                : "Regelbasierte Klassifizierung; Eigentümer nicht verifiziert",
          ],
          [
            "Investment-Eignung",
            company.score?.toString() ?? "—",
            company.score
              ? "Versioniertes Modellergebnis"
              : "Kein aktiver Score",
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
          <h2 className="text-base font-semibold">Aktuelles Profil</h2>
          <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Field label="Rechtsform" value={company.legalForm} />
            <Field
              label="Handelsregisternummer"
              value={company.registerReference}
            />
            <Field label="Registergericht" value={company.registerCourt} />
            <Field label="Branche" value={company.industry} />
            <Field
              label="Gegründet"
              value={
                company.incorporationDate
                  ? new Intl.DateTimeFormat("de-DE", {
                      dateStyle: "medium",
                    }).format(new Date(company.incorporationDate))
                  : "N/V"
              }
            />
            <Field
              label="Stammkapital"
              value={formatMoney(company.capitalCents)}
            />
            <Field
              label="Eigentümerstruktur"
              value={ownershipLabel(company.ownership)}
            />
            <Field
              label="Grundlage der Klassifizierung"
              value={
                company.ownershipMethod === "rules"
                  ? "Regelbasierte Ableitung"
                  : company.ownershipMethod === "openregister_flag"
                    ? "OpenRegister-Klassifizierung"
                    : company.ownershipMethod === "ai_with_evidence"
                      ? "Evidenzbasierte Klassifizierung"
                      : "Analystenklassifizierung"
              }
            />
            <Field
              label="Profil aktualisiert"
              value={new Intl.DateTimeFormat("de-DE", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Europe/Berlin",
              }).format(new Date(company.updatedAt))}
            />
            <Field
              label="Datenklassifizierung"
              value={
                company.sourceType === "reported"
                  ? "Gemeldete Quelldaten"
                  : "Schätzung"
              }
            />
          </dl>
          <div className="mt-7 border-t border-[#e1ded6] pt-6">
            <h3 className="text-sm font-semibold">Unternehmensgegenstand</h3>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-[#4f5d58]">
              {company.purpose}
            </p>
          </div>
          <div className="mt-7 grid gap-6 border-t border-[#e1ded6] pt-6 md:grid-cols-2">
            <ProfileList
              title="Management"
              empty="N/V"
              rows={company.management.map(
                (person) => `${person.name} · ${person.role}`,
              )}
            />
            <ProfileList
              title="Eigentümer"
              empty="N/V"
              rows={company.owners.map(
                (owner) =>
                  `${owner.name}${owner.percentage === null ? "" : ` · ${owner.percentage}%`}`,
              )}
            />
          </div>
          <div className="mt-7 border-t border-[#e1ded6] pt-6">
            <h3 className="text-sm font-semibold">Anbieteranreicherung</h3>
            {enrichment.apollo || enrichment.webSources.length ? (
              <div className="mt-4 space-y-4">
                {enrichment.apollo ? (
                  <div className="rounded-lg border border-[#e0ddd5] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[.08em] text-[#75807c]">
                      Apollo · geschätzte Daten
                    </p>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                      <p>
                        <span className="block text-xs text-[#7a8580]">
                          Beschäftigte
                        </span>
                        {enrichment.apollo.estimated_employees ?? "N/V"}
                      </p>
                      <p>
                        <span className="block text-xs text-[#7a8580]">
                          Umsatz
                        </span>
                        {formatMoney(enrichment.apollo.estimated_revenue_cents)}
                      </p>
                      <p>
                        <span className="block text-xs text-[#7a8580]">
                          Domain
                        </span>
                        {enrichment.apollo.domain ?? "N/V"}
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
                        {source.provider} · Quellenbeleg
                      </p>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#087b62]"
                      >
                        Quelle öffnen <ExternalLink size={11} />
                      </a>
                    </div>
                    <p className="mt-2 text-sm font-semibold">
                      {source.title ?? source.url}
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#68736e]">
                      {source.supporting_excerpt ||
                        "Kein Textauszug geliefert."}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#7a8580]">
                Für dieses Unternehmen wurde noch kein Ergebnis von Apollo,
                Tavily oder Firecrawl gespeichert.
              </p>
            )}
          </div>
          <div className="mt-7 grid gap-4 border-t border-[#e1ded6] pt-6 sm:grid-cols-2 xl:grid-cols-4">
            <FinancialField label="EBIT" value={company.ebitCents} />
            <FinancialField label="Eigenkapital" value={company.equityCents} />
            <FinancialField
              label="Finanzverbindlichkeiten"
              value={company.debtCents}
            />
            <FinancialField
              label="Bilanzsumme"
              value={company.totalAssetsCents}
            />
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} className="text-[#13745f]" />
              <h2 className="text-base font-semibold">Verfügbare Aktionen</h2>
            </div>
            {readyProviders.length === 0 ? (
              <>
                <p className="mt-3 text-sm leading-6 text-[#68736e]">
                  Es werden keine Anbieteraktionen angezeigt, weil keine Quelle
                  vollständig konfiguriert und geprüft ist.
                </p>
                <Link
                  href="/settings?section=integrations"
                  className="mt-4 inline-flex text-sm font-semibold text-[#087b62]"
                >
                  Integrationen prüfen →
                </Link>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6 text-[#68736e]">
                  Jede Aktion speichert normalisierte Felder, Rohdatenbelege,
                  Credits und den Abschlusszeitpunkt. Frühere Läufe bleiben
                  sichtbar, bevor erneut Credits verbraucht werden.
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
              <History size={17} className="text-[#13745f]" />
              <h2 className="text-base font-semibold">Ausführungshistorie</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#68736e]">
              Abgeschlossene Läufe aktualisieren die normalisierten
              Unternehmensdaten und bewahren Rohdatenbelege auf. Die
              vollständige Historie finden Sie unter „Log“.
            </p>
            {jobs.length ? (
              <div className="mt-5 divide-y divide-[#e3e0d8]">
                {jobs.map((job) => (
                  <div key={job.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">
                        {jobTypeLabel(job.type)}
                      </p>
                      <span className="text-xs font-semibold capitalize text-[#42645b]">
                        {jobStatusLabel(job.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#7b8581]">
                      {job.provider} ·{" "}
                      {new Intl.DateTimeFormat("de-DE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(job.createdAt))}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-[#f0eee9] p-3 text-sm text-[#68736e]">
                Für dieses Unternehmen wurde noch kein Anbieterlauf erfasst.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function displayWebsiteHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
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
