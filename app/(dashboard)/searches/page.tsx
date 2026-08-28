import { PageHeader } from "@/components/app-shell";
import { EmptyDataState } from "@/components/empty-data-state";
import { SearchBuilder } from "@/components/search-builder";
import { requireUser } from "@/lib/auth/user";
import { listSavedSearches } from "@/lib/data/searches";
import { getIntegrationStatuses, hasLiveDataBackend } from "@/lib/integrations/status";

export default async function SearchesPage() {
  const user = await requireUser();
  const databaseReady = hasLiveDataBackend();
  const openRegisterReady = getIntegrationStatuses().find((provider) => provider.id === "openregister")?.usable ?? false;
  const searches = databaseReady ? await listSavedSearches(user.workspaceId) : [];

  return <div className="mx-auto max-w-[1500px] p-5 md:p-9">
    <PageHeader eyebrow="Discovery engine" title="Saved searches" description="Build an OpenRegister query, run it on demand, and retain its filters and run history." action={openRegisterReady ? <SearchBuilder /> : undefined} />
    {!openRegisterReady ? <EmptyDataState title="Discovery is not ready" description="OpenRegister and the production database must both be ready before a live search can run." /> : searches.length ? <div className="mt-8 grid gap-5 xl:grid-cols-2">{searches.map((search) => <article key={search.id} className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-6"><div className="flex items-center justify-between gap-4"><h2 className="text-base font-semibold">{search.name}</h2><span className={`rounded-full px-2.5 py-1.5 text-xs font-semibold ${search.active ? "bg-[#e0f2ec] text-[#236a58]" : "bg-[#eceae5] text-[#717a76]"}`}>{search.active ? "Scheduled" : "Manual"}</span></div><p className="mt-3 text-sm leading-6 text-[#68736e]">{search.summary}</p><dl className="mt-5 grid grid-cols-3 gap-4 border-t border-[#e3e0d8] pt-4 text-sm"><div><dt className="text-xs text-[#84908b]">Hydration</dt><dd className="mt-1 font-semibold capitalize">{search.hydrationMode}</dd></div><div><dt className="text-xs text-[#84908b]">Last run</dt><dd className="mt-1 font-semibold">{search.lastRunAt ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(search.lastRunAt)) : "Not run"}</dd></div><div><dt className="text-xs text-[#84908b]">Last result</dt><dd className="mt-1 font-semibold">{search.lastRunStatus ? `${search.lastRunStatus} · ${search.lastAccepted ?? 0} new` : "N/A"}</dd></div></dl></article>)}</div> : <section className="mt-8 rounded-2xl border border-[#d8d5cc] bg-[#faf9f6] px-6 py-14 text-center"><h2 className="text-xl font-semibold">No saved searches yet</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#68736e]">The live integration is ready. Use “New saved search” above to configure filters and run OpenRegister.</p></section>}
  </div>;
}
