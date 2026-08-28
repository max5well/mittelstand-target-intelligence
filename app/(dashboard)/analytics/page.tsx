import { PageHeader } from "@/components/app-shell";
import { EmptyDataState } from "@/components/empty-data-state";
import { requireUser } from "@/lib/auth/user";
import { listCompanies } from "@/lib/data/companies";
import { listJobs } from "@/lib/data/jobs";
import { formatMoney } from "@/lib/format";
import { hasLiveDataBackend } from "@/lib/integrations/status";

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export default async function AnalyticsPage() {
  const user = await requireUser();
  const configured = hasLiveDataBackend();
  const [companies, jobs] = configured
    ? await Promise.all([
        listCompanies(user.workspaceId, user.id),
        listJobs(user.workspaceId),
      ])
    : [[], []];
  const ownership = [...new Set(companies.map((company) => company.ownership))]
    .map((category) => ({
      category,
      count: companies.filter((company) => company.ownership === category)
        .length,
    }))
    .sort((a, b) => b.count - a.count);
  const states = [...new Set(companies.map((company) => company.state))]
    .map((state) => ({
      state,
      count: companies.filter((company) => company.state === state).length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const creditUsage = jobs.reduce((sum, job) => sum + job.credits, 0);
  const medianRevenue = median(
    companies.flatMap((company) =>
      company.revenueCents === null ? [] : [company.revenueCents],
    ),
  );

  return (
    <div className="mx-auto max-w-[1500px] p-5 md:p-9">
      <PageHeader
        eyebrow="Portfolio-Intelligence"
        title="Analysen"
        description="Abdeckungsbewusste Analysen auf Basis des aktuellen Live-Arbeitsbereichs."
      />
      {!companies.length ? (
        <EmptyDataState
          title="Noch keine Live-Analysen"
          description="Analysen werden aus gespeicherten Unternehmens- und Anbieteraufträgen berechnet. Es werden keine Platzhalterkennzahlen angezeigt."
        />
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [
                "Unternehmen",
                companies.length.toLocaleString("de-DE"),
                "Live-Datensätze",
              ],
              [
                "Favoriten",
                companies
                  .filter((company) => company.favorite)
                  .length.toLocaleString("de-DE"),
                "Aktueller Benutzer",
              ],
              [
                "Medianumsatz",
                formatMoney(medianRevenue),
                `${companies.filter((company) => company.revenueCents !== null).length} gemeldet`,
              ],
              [
                "Anbieter-Credits",
                creditUsage.toLocaleString("de-DE"),
                `${jobs.length} erfasste Aufträge`,
              ],
            ].map(([label, value, note]) => (
              <div
                key={label}
                className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5"
              >
                <p className="text-sm text-[#75807c]">{label}</p>
                <p className="mt-3 text-2xl font-semibold tabular-nums">
                  {value}
                </p>
                <p className="mt-2 text-xs text-[#7a8580]">{note}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Distribution
              title="Eigentümerstruktur"
              items={ownership.map((item) => [item.category, item.count])}
              total={companies.length}
            />
            <Distribution
              title="Geografische Verteilung"
              items={states.map((item) => [item.state, item.count])}
              total={companies.length}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Distribution({
  title,
  items,
  total,
}: {
  title: string;
  items: [string, number][];
  total: number;
}) {
  return (
    <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-5 space-y-4">
        {items.map(([label, count]) => (
          <div key={label}>
            <div className="mb-2 flex justify-between gap-4 text-sm">
              <span>{label}</span>
              <span className="font-semibold tabular-nums">{count}</span>
            </div>
            <div className="h-2 rounded bg-[#e7e4dd]">
              <div
                className="h-full rounded bg-[#2b9275]"
                style={{ width: `${(count / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
