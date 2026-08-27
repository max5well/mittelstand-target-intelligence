import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { jobs } from "@/lib/mock-data";

const statusConfig = {
  running: ["Running", "text-[#217660] bg-[#e3f3ee]", RefreshCw],
  succeeded: ["Succeeded", "text-[#27705d] bg-[#e4f1ed]", CheckCircle2],
  failed: ["Failed", "text-[#a64238] bg-[#f7e8e5]", XCircle],
  retry_wait: ["Retry wait", "text-[#8a6b1e] bg-[#fff2cf]", Clock3],
  queued: ["Queued", "text-[#426075] bg-[#e7eef2]", Clock3],
  cancelled: ["Cancelled", "text-[#6e7673] bg-[#eceae6]", XCircle],
} as const;

export default function JobsPage() {
  return (
    <div className="mx-auto max-w-[1500px] p-5 md:p-9">
      <PageHeader
        eyebrow="Operations"
        title="Jobs & usage"
        description="Track asynchronous enrichment, retries, idempotency, freshness, and provider consumption."
      />
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Jobs today", "96", "88 succeeded"],
          ["Credits today", "1,174", "€ estimate unavailable"],
          ["Retrying", "1", "Backoff honored"],
          ["Missing runs", "0", "All schedules healthy"],
        ].map(([label, value, note]) => (
          <div
            key={label}
            className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-4"
          >
            <p className="text-[11px] text-[#75807c]">{label}</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
            <p className="mt-2 text-[10px] text-[#7a8580]">{note}</p>
          </div>
        ))}
      </div>
      <section className="mt-5 overflow-hidden rounded-xl border border-[#d8d5cc] bg-[#faf9f6]">
        <div className="flex items-center justify-between border-b border-[#e1ded6] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Recent jobs</h2>
            <p className="mt-1 text-xs text-[#75807c]">
              Atomic leases · unique idempotency keys · provider-specific
              retries
            </p>
          </div>
          <button className="flex h-9 items-center gap-2 rounded-lg border border-[#d6d3cb] bg-white px-3 text-xs font-semibold">
            <RotateCcw size={13} /> Retry failed
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-[#f3f1ec] text-[#75807c]">
              <tr>
                {[
                  "Job",
                  "Provider",
                  "Type",
                  "Status",
                  "Credits",
                  "Duration",
                  "Updated",
                  "Issue",
                ].map((header) => (
                  <th key={header} className="px-5 py-3 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const [label, className, Icon] = statusConfig[job.status];
                return (
                  <tr key={job.id} className="border-t border-[#e5e2db]">
                    <td className="max-w-[240px] truncate px-5 py-4 font-medium">
                      {job.company}
                    </td>
                    <td className="px-5 py-4">{job.provider}</td>
                    <td className="px-5 py-4">{job.type}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-semibold ${className}`}
                      >
                        <Icon
                          size={10}
                          className={
                            job.status === "running" ? "animate-spin" : ""
                          }
                        />
                        {label}
                      </span>
                    </td>
                    <td className="px-5 py-4 tabular-nums">{job.credits}</td>
                    <td className="px-5 py-4 tabular-nums">{job.duration}</td>
                    <td className="px-5 py-4">{job.updatedAt}</td>
                    <td className="max-w-[260px] px-5 py-4 text-[#8b4a3f]">
                      {job.error ? (
                        <span className="flex items-center gap-2">
                          <AlertTriangle size={12} />
                          {job.error}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
