import { PageHeader } from "@/components/app-shell";
import { EmptyDataState } from "@/components/empty-data-state";
import { SearchBuilder } from "@/components/search-builder";
import { acquisitionTargetPreset } from "@/lib/acquisition-target-preset";
import { requireUser } from "@/lib/auth/user";
import { listSavedSearches } from "@/lib/data/searches";
import { jobStatusLabel } from "@/lib/format";
import {
  getIntegrationStatuses,
  hasLiveDataBackend,
} from "@/lib/integrations/status";

export default async function SearchesPage() {
  const user = await requireUser();
  const databaseReady = hasLiveDataBackend();
  const openRegisterReady =
    getIntegrationStatuses().find((provider) => provider.id === "openregister")
      ?.usable ?? false;
  const searches = databaseReady
    ? await listSavedSearches(user.workspaceId)
    : [];

  return (
    <div className="mx-auto max-w-[1500px] p-5 md:p-9">
      <PageHeader
        eyebrow="Suchmaschine"
        title="Gespeicherte Suchen"
        description="Erstellen Sie eine OpenRegister-Abfrage, führen Sie sie bei Bedarf aus und speichern Sie Filter sowie Ausführungshistorie."
        action={openRegisterReady ? <SearchBuilder /> : undefined}
      />
      {!openRegisterReady ? (
        <EmptyDataState
          title="Die Suche ist noch nicht bereit"
          description="OpenRegister und die Produktionsdatenbank müssen bereit sein, bevor eine Live-Suche ausgeführt werden kann."
        />
      ) : searches.length ? (
        <div className="mt-8 grid gap-5 xl:grid-cols-2">
          {searches.map((search) => (
            <article
              key={search.id}
              className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-base font-semibold">{search.name}</h2>
                <span
                  className={`rounded-full px-2.5 py-1.5 text-xs font-semibold ${search.active ? "bg-[#e0f2ec] text-[#236a58]" : "bg-[#eceae5] text-[#717a76]"}`}
                >
                  {search.active ? "Geplant" : "Manuell"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#68736e]">
                {search.summary}
              </p>
              <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-[#e3e0d8] pt-4 text-sm">
                <div>
                  <dt className="text-xs text-[#84908b]">Datenumfang</dt>
                  <dd className="mt-1 font-semibold capitalize">
                    {search.hydrationMode === "full"
                      ? "Vollständig"
                      : search.hydrationMode === "lean"
                        ? "Kompakt"
                        : "Benutzerdefiniert"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#84908b]">Letzte Ausführung</dt>
                  <dd className="mt-1 font-semibold">
                    {search.lastRunAt
                      ? new Intl.DateTimeFormat("de-DE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(search.lastRunAt))
                      : "Noch nicht ausgeführt"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#84908b]">Letztes Ergebnis</dt>
                  <dd className="mt-1 font-semibold">
                    {search.lastRunStatus
                      ? `${jobStatusLabel(search.lastRunStatus)} · ${search.lastAccepted ?? 0} neu`
                      : "N/V"}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <section className="mt-8 rounded-2xl border border-[#d8d5cc] bg-[#faf9f6] p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16856b]">
                Vorbereiteter Suchentwurf
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                {acquisitionTargetPreset.name}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68736e]">
                Ihre Akquisitionskriterien sind unten vorkonfiguriert. Prüfen
                und speichern Sie den Entwurf, bevor eine kostenpflichtige
                OpenRegister-Abfrage gestartet wird.
              </p>
            </div>
            <SearchBuilder triggerLabel="Abfrage prüfen & speichern" />
          </div>
          <dl className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              [
                "Branchen",
                "Klimagerätebau, Klima-/Lüftungsinstallation, Dachdecker",
              ],
              ["Regionen", acquisitionTargetPreset.states.join(", ")],
              ["Rechtsformen", "GmbH, GmbH & Co. KG"],
              ["Umsatz", "10–50 Mio. € (abgeleitet aus 10–20 % EBITDA-Marge)"],
              [
                "EBITDA",
                "Präferenz 2–5 Mio. €; ohne Meldung nicht erforderlich",
              ],
              [
                "Insolvenz",
                "Laufende Insolvenzen ausgeschlossen; frühere Fälle zulässig",
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-[#e1ded6] bg-white p-4"
              >
                <dt className="text-xs font-semibold uppercase tracking-[.1em] text-[#7a8580]">
                  {label}
                </dt>
                <dd className="mt-2 text-sm font-medium leading-5 text-[#26322e]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs leading-5 text-[#7a8580]">
            Das Speichern des Entwurfs führt die Abfrage nicht aus. Die
            Treffervorschau kostet 10 OpenRegister-Credits; „Speichern & jetzt
            ausführen“ startet die ausgewählten kostenpflichtigen Abfragen.
          </p>
        </section>
      )}
    </div>
  );
}
