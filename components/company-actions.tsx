"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, RefreshCw, Users } from "lucide-react";

type Stage = "details" | "financials" | "owners";
type PreviousRun = {
  stage: Stage;
  completedAt: string | null;
  available: boolean;
};

const actions: Array<{
  stage: Stage;
  label: string;
  description: string;
  icon: typeof RefreshCw;
}> = [
  {
    stage: "details",
    label: "Refresh profile",
    description: "Address, industry, purpose and management",
    icon: RefreshCw,
  },
  {
    stage: "financials",
    label: "Fetch financials",
    description: "Reported periods; N/A when OpenRegister has none",
    icon: FileText,
  },
  {
    stage: "owners",
    label: "Fetch ownership",
    description: "Shareholders and ownership percentages",
    icon: Users,
  },
];

export function CompanyActions({
  companyId,
  previousRuns,
}: {
  companyId: string;
  previousRuns: PreviousRun[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Stage | "all" | null>(null);
  const [message, setMessage] = useState("");
  const latest = new Map(previousRuns.map((run) => [run.stage, run]));

  async function run(stage: Stage, force: boolean) {
    const response = await fetch(`/api/companies/${companyId}/enrich`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, force }),
    });
    const result = (await response.json()) as {
      error?: string;
      skipped?: boolean;
      available?: boolean;
    };
    if (!response.ok) throw new Error(result.error ?? `${stage} failed`);
    return result;
  }

  async function runOne(stage: Stage) {
    setBusy(stage);
    setMessage("");
    try {
      const result = await run(stage, latest.has(stage));
      setMessage(
        result.available === false
          ? `${stage} checked: OpenRegister reports no data for this company.`
          : `${stage} updated successfully.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Provider action failed");
    } finally {
      setBusy(null);
    }
  }

  async function runAll() {
    setBusy("all");
    setMessage("Running full OpenRegister enhancement…");
    try {
      for (const action of actions) await run(action.stage, latest.has(action.stage));
      setMessage("Full OpenRegister enhancement completed.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Full enhancement failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      {actions.map(({ stage, label, description, icon: Icon }) => {
        const previous = latest.get(stage);
        return (
          <button
            key={stage}
            type="button"
            disabled={busy !== null}
            onClick={() => runOne(stage)}
            className="flex w-full items-start gap-3 rounded-lg border border-[#d8d5cc] bg-white p-3 text-left transition hover:border-[#9fc9bc] disabled:opacity-55"
          >
            <Icon size={16} className={busy === stage ? "mt-0.5 animate-spin text-[#16856b]" : "mt-0.5 text-[#16856b]"} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{previous ? `Run ${label.toLocaleLowerCase()} again` : label}</span>
              <span className="mt-0.5 block text-xs leading-5 text-[#75807c]">{description}</span>
              {previous ? (
                <span className="mt-1 flex items-center gap-1 text-xs font-medium text-[#31735f]">
                  <CheckCircle2 size={11} /> Last run {formatRunDate(previous.completedAt)} · {previous.available ? "data returned" : "not available"}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-[#75807c]">10 cr</span>
          </button>
        );
      })}
      <button
        type="button"
        disabled={busy !== null}
        onClick={runAll}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#13201d] px-4 text-sm font-semibold text-white disabled:opacity-55"
      >
        <RefreshCw size={14} className={busy === "all" ? "animate-spin" : ""} />
        Full enhancement · 30 credits
      </button>
      {message ? <p role="status" className="rounded-lg bg-[#edf4f1] p-3 text-xs leading-5 text-[#42645b]">{message}</p> : null}
    </div>
  );
}

function formatRunDate(value: string | null) {
  if (!value) return "recorded";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
