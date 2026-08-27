import { ArrowUpRight, Star } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell";
import { EmptyDataState } from "@/components/empty-data-state";
import { requireUser } from "@/lib/auth/user";
import { listCompanies } from "@/lib/data/companies";
import { formatMoney, statusLabel } from "@/lib/format";
import { hasLiveDataBackend } from "@/lib/integrations/status";

export default async function OverviewPage() {
  const user = await requireUser();
  const companies = hasLiveDataBackend() ? await listCompanies(user.workspaceId) : [];
  const shortlisted = companies.filter((company) => company.status === "shortlisted").length;
  const activeDialogue = companies.filter((company) => ["in_conversation", "nda", "diligence"].includes(company.status)).length;
  const withFinancials = companies.filter((company) => company.revenueCents !== null).length;
  const targets = [...companies].filter((company) => company.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);

  return (
    <div className="mx-auto max-w-[1500px] p-5 md:p-9">
      <PageHeader eyebrow="Workspace overview" title="Your target universe" description="Prioritize German companies while keeping every decision tied to a stored source and run history." />
      {!companies.length ? <EmptyDataState /> : <>
        <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-[#d8d5cc] bg-[#d8d5cc] sm:grid-cols-2 xl:grid-cols-4">
          {[["Companies tracked", companies.length.toLocaleString(), "Live workspace records"], ["Shortlisted", shortlisted.toLocaleString(), "Current pipeline"], ["Active dialogue", activeDialogue.toLocaleString(), "Conversation through diligence"], ["Financial coverage", `${Math.round((withFinancials / companies.length) * 100)}%`, "Companies with reported revenue"]].map(([label, value, note]) => <div key={label} className="bg-[#faf9f6] p-5"><p className="text-sm text-[#73807b]">{label}</p><p className="mt-4 text-3xl font-semibold tabular-nums">{value}</p><p className="mt-2 text-xs text-[#5f6e69]">{note}</p></div>)}
        </div>
        <section className="mt-6 overflow-hidden rounded-xl border border-[#d8d5cc] bg-[#faf9f6]">
          <div className="flex items-center justify-between border-b border-[#e3e0d8] px-5 py-4"><div><h2 className="text-base font-semibold">Highest-fit targets</h2><p className="mt-1 text-sm text-[#75807c]">Only companies with a stored score are included</p></div><Link href="/companies" className="flex items-center gap-1 text-sm font-semibold text-[#16856b]">View all <ArrowUpRight size={14} /></Link></div>
          {targets.length ? <div className="divide-y divide-[#ebe8e1]">{targets.map((company) => <Link key={company.id} href={`/companies/${company.id}`} className="grid gap-2 px-5 py-4 transition hover:bg-white sm:grid-cols-[1fr_160px_160px_80px] sm:items-center"><span className="font-semibold"><Star size={14} className="mr-3 inline text-[#d2a534]" fill={company.favorite ? "currentColor" : "none"} />{company.name}</span><span className="text-sm text-[#66716d]">{company.city}</span><span className="text-sm font-medium tabular-nums">{formatMoney(company.revenueCents)}</span><span className="text-sm font-semibold text-[#16856b]">{company.score}</span><span className="sr-only">{statusLabel(company.status)}</span></Link>)}</div> : <p className="p-6 text-sm text-[#68736e]">No scored companies yet.</p>}
        </section>
      </>}
    </div>
  );
}
