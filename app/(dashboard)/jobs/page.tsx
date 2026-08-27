import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { EmptyDataState } from "@/components/empty-data-state";
import { requireUser } from "@/lib/auth/user";
import { listJobs } from "@/lib/data/jobs";
import { hasLiveDataBackend } from "@/lib/integrations/status";

const statusConfig = {
  running: ["Running", "text-[#217660] bg-[#e3f3ee]", RefreshCw], succeeded: ["Succeeded", "text-[#27705d] bg-[#e4f1ed]", CheckCircle2], failed: ["Failed", "text-[#a64238] bg-[#f7e8e5]", XCircle], retry_wait: ["Retry wait", "text-[#8a6b1e] bg-[#fff2cf]", Clock3], queued: ["Queued", "text-[#426075] bg-[#e7eef2]", Clock3], cancelled: ["Cancelled", "text-[#6e7673] bg-[#eceae6]", XCircle], dead_letter: ["Dead letter", "text-[#a64238] bg-[#f7e8e5]", XCircle],
} as const;

export default async function JobsPage() {
  const user = await requireUser();
  const jobs = hasLiveDataBackend() ? await listJobs(user.workspaceId) : [];
  const credits = jobs.reduce((sum, job) => sum + job.credits, 0);
  return <div className="mx-auto max-w-[1500px] p-5 md:p-9">
    <PageHeader eyebrow="Operations" title="Jobs & usage" description="Every provider run, retry, recorded credit, and failure in one auditable history." />
    {!jobs.length ? <EmptyDataState title="No provider runs recorded" description="Provider actions will appear only after the connection and persistence flow have been verified. Completed runs will be listed here." /> : <>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">{[["Recorded jobs", jobs.length], ["Succeeded", jobs.filter((job) => job.status === "succeeded").length], ["Recorded credits", credits]].map(([label, value]) => <div key={label} className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5"><p className="text-sm text-[#75807c]">{label}</p><p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p></div>)}</div>
      <section className="mt-6 overflow-hidden rounded-xl border border-[#d8d5cc] bg-[#faf9f6]"><div className="border-b border-[#e1ded6] px-5 py-4"><h2 className="text-base font-semibold">Run history</h2><p className="mt-1 text-sm text-[#75807c]">Persisted records, newest first</p></div><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-[#f3f1ec] text-[#75807c]"><tr>{["Company", "Provider", "Action", "Status", "Credits", "Started", "Issue"].map((header) => <th key={header} className="px-5 py-3 font-medium">{header}</th>)}</tr></thead><tbody>{jobs.map((job) => { const config = statusConfig[job.status as keyof typeof statusConfig] ?? statusConfig.failed; const [label, className, Icon] = config; return <tr key={job.id} className="border-t border-[#e5e2db]"><td className="px-5 py-4 font-medium">{job.company}</td><td className="px-5 py-4">{job.provider}</td><td className="px-5 py-4">{job.type}</td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${className}`}><Icon size={11} className={job.status === "running" ? "animate-spin" : ""} />{label}</span></td><td className="px-5 py-4 tabular-nums">{job.credits}</td><td className="px-5 py-4">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(job.createdAt))}</td><td className="max-w-[260px] px-5 py-4 text-[#8b4a3f]">{job.error ? <span className="flex items-center gap-2"><AlertTriangle size={13} />{job.error}</span> : "—"}</td></tr>; })}</tbody></table></div></section>
    </>}
  </div>;
}
