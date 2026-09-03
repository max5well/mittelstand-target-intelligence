import { PageHeader } from "@/components/app-shell";
import { EmptyDataState } from "@/components/empty-data-state";
import { SearchBuilder } from "@/components/search-builder";
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
        action={
          openRegisterReady ? (
            <SearchBuilder workspaceId={user.workspaceId} />
          ) : undefined
        }
      />
      {!openRegisterReady ? (
        <EmptyDataState
          title="Die Suche ist noch nicht bereit"
          description="OpenRegister und die Produktionsdatenbank müssen bereit sein, bevor eine Live-Suche ausgeführt werden kann."
        />
      ) : (
        <>
          {searches.length ? (
            <section className="mt-8">
              <h2 className="text-xl font-semibold">Gespeicherte Suchen</h2>
              <div className="mt-5 grid gap-5 xl:grid-cols-2">
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
                        <dt className="text-xs text-[#84908b]">
                          Letzte Ausführung
                        </dt>
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
                        <dt className="text-xs text-[#84908b]">
                          Letztes Ergebnis
                        </dt>
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
            </section>
          ) : (
            <section className="mt-8 rounded-2xl border border-dashed border-[#c9c6bd] bg-[#faf9f6] px-6 py-12 text-center">
              <h2 className="text-xl font-semibold">
                Noch keine gespeicherten Suchen
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#68736e]">
                Erstellen Sie über „Neue Suche erstellen“ eine Abfrage ohne
                vorausgewählte Zielgruppe. Nach dem Speichern erscheint sie
                hier.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
