"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileSearch,
  FileText,
  Globe2,
  RefreshCw,
  Users,
} from "lucide-react";

type Stage =
  | "website_discovery"
  | "details"
  | "financials"
  | "owners"
  | "apollo_organization"
  | "firecrawl_website"
  | "tavily_research";
type PreviousRun = {
  stage: Stage;
  provider: string;
  completedAt: string | null;
  available: boolean;
};

const actions: Array<{
  stage: Stage;
  provider: "openregister" | "apollo" | "firecrawl" | "tavily";
  label: string;
  description: string;
  icon: typeof RefreshCw;
  credits: string;
  requiredProviders?: Array<"openregister" | "apollo" | "firecrawl" | "tavily">;
}> = [
  {
    stage: "details",
    provider: "openregister",
    label: "Refresh profile",
    description: "Address, industry, purpose and management",
    icon: RefreshCw,
    credits: "10 cr",
  },
  {
    stage: "financials",
    provider: "openregister",
    label: "Fetch financials",
    description: "Reported periods; N/A when OpenRegister has none",
    icon: FileText,
    credits: "10 cr",
  },
  {
    stage: "owners",
    provider: "openregister",
    label: "Fetch ownership",
    description: "Shareholders and ownership percentages",
    icon: Users,
    credits: "10 cr",
  },
  {
    stage: "website_discovery",
    provider: "tavily",
    label: "Find & verify website",
    description:
      "Tavily candidate verified against the OpenRegister company ID",
    icon: Globe2,
    credits: "up to 12 cr",
    requiredProviders: ["tavily", "openregister"],
  },
  {
    stage: "apollo_organization",
    provider: "apollo",
    label: "Enrich with Apollo",
    description: "Estimated headcount, revenue and organization match",
    icon: Users,
    credits: "1 cr",
  },
  {
    stage: "firecrawl_website",
    provider: "firecrawl",
    label: "Analyze company website",
    description: "First-party website content saved as source evidence",
    icon: Globe2,
    credits: "est. 1–5 cr",
  },
  {
    stage: "tavily_research",
    provider: "tavily",
    label: "Research web & news",
    description: "External sources, titles, excerpts and URLs",
    icon: FileSearch,
    credits: "2 cr",
  },
];

export function CompanyActions({
  companyId,
  previousRuns,
  availableProviders,
  hasWebsite,
}: {
  companyId: string;
  previousRuns: PreviousRun[];
  availableProviders: string[];
  hasWebsite: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Stage | "all" | null>(null);
  const [message, setMessage] = useState("");
  const latest = new Map(
    previousRuns.map((run) => [`${run.provider}:${run.stage}`, run]),
  );
  const visibleActions = actions.filter(
    (action) =>
      availableProviders.includes(action.provider) &&
      (action.requiredProviders ?? []).every((provider) =>
        availableProviders.includes(provider),
      ),
  );

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
      const action = actions.find((candidate) => candidate.stage === stage);
      const key = `${action?.provider ?? "openregister"}:${stage}`;
      const result = await run(stage, latest.has(key));
      setMessage(
        result.available === false
          ? `${action?.label ?? stage} completed, but the provider returned no matching data.`
          : `${action?.label ?? stage} completed and the results were saved below.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Provider action failed",
      );
    } finally {
      setBusy(null);
    }
  }

  async function runAll() {
    setBusy("all");
    setMessage("Running full OpenRegister enhancement…");
    try {
      for (const action of actions.filter(
        (candidate) => candidate.provider === "openregister",
      ))
        await run(
          action.stage,
          latest.has(`${action.provider}:${action.stage}`),
        );
      setMessage("Full OpenRegister enhancement completed.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Full enhancement failed",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      {visibleActions.map(
        ({ stage, provider, label, description, icon: Icon, credits }) => {
          const previous = latest.get(`${provider}:${stage}`);
          const needsWebsite =
            (provider === "apollo" || provider === "firecrawl") && !hasWebsite;
          return (
            <button
              key={stage}
              type="button"
              disabled={busy !== null || needsWebsite}
              onClick={() => runOne(stage)}
              className="flex w-full items-start gap-3 rounded-lg border border-[#d8d5cc] bg-white p-3 text-left transition hover:border-[#9fc9bc] disabled:opacity-55"
            >
              <Icon
                size={16}
                className={
                  busy === stage
                    ? "mt-0.5 animate-spin text-[#16856b]"
                    : "mt-0.5 text-[#16856b]"
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {previous ? `${label} again` : label}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-[#75807c]">
                  {description}
                </span>
                {needsWebsite ? (
                  <span className="mt-1 block text-xs font-medium text-[#8b5a2b]">
                    Unavailable until a verified website is stored
                  </span>
                ) : null}
                {previous ? (
                  <span className="mt-1 flex items-center gap-1 text-xs font-medium text-[#31735f]">
                    <CheckCircle2 size={11} /> Last run{" "}
                    {formatRunDate(previous.completedAt)} ·{" "}
                    {previous.available ? "data returned" : "not available"}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-[#75807c]">
                {credits}
              </span>
            </button>
          );
        },
      )}
      {availableProviders.includes("openregister") ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={runAll}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#13201d] px-4 text-sm font-semibold text-white disabled:opacity-55"
        >
          <RefreshCw
            size={14}
            className={busy === "all" ? "animate-spin" : ""}
          />
          Full enhancement · 30 credits
        </button>
      ) : null}
      {message ? (
        <p
          role="status"
          className="rounded-lg bg-[#edf4f1] p-3 text-xs leading-5 text-[#42645b]"
        >
          {message}
        </p>
      ) : null}
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
