import { PageHeader } from "@/components/app-shell";
import { EmptyDataState } from "@/components/empty-data-state";
import { requireUser } from "@/lib/auth/user";
import { listSavedSearches } from "@/lib/data/searches";
import { getIntegrationStatuses, hasLiveDataBackend } from "@/lib/integrations/status";

export default async function SearchesPage() {
  const user = await requireUser();
  const databaseReady = hasLiveDataBackend();
  const openRegisterReady = getIntegrationStatuses().find((provider) => provider.id === "openregister")?.usable ?? false;
  const searches = databaseReady ? await listSavedSearches(user.workspaceId) : [];

  return <div className="mx-auto max-w-[1500px] p-5 md:p-9">
    <PageHeader eyebrow="Discovery engine" title="Saved searches" description="Repeatable OpenRegister discovery runs with stored filters, status, and run history." />
    {!openRegisterReady ? <EmptyDataState title="Discovery is not ready" description="Saved-search controls are hidden until OpenRegister and the production database are configured and the first run has passed verification." /> : searches.length ? <div className="mt-8 grid gap-5 xl:grid-cols-2">{searches.map((search) => <article key={search.id} className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-6"><div className="flex items-center justify-between gap-4"><h2 className="text-base font-semibold">{search.name}</h2><span className={`rounded-full px-2.5 py-1.5 text-xs font-semibold ${search.active ? "bg-[#e0f2ec] text-[#236a58]" : "bg-[#eceae5] text-[#717a76]"}`}>{search.active ? "Active" : "Paused"}</span></div><p className="mt-3 text-sm leading-6 text-[#68736e]">{search.summary}</p><dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[#e3e0d8] pt-4 text-sm"><div><dt className="text-xs text-[#84908b]">Hydration</dt><dd className="mt-1 font-semibold capitalize">{search.hydrationMode}</dd></div><div><dt className="text-xs text-[#84908b]">Updated</dt><dd className="mt-1 font-semibold">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(search.updatedAt))}</dd></div></dl></article>)}</div> : <EmptyDataState title="No saved searches yet" description="The integration is ready, but no persisted discovery search exists yet." />}
  </div>;
}
