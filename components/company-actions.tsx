"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  FileSearch,
  FileText,
  Globe2,
  RefreshCw,
  Users,
  X,
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
type WebsiteToast = {
  kind: "success" | "not-found";
  message: string;
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
    label: "Profil aktualisieren",
    description: "Adresse, Branche, Unternehmensgegenstand und Management",
    icon: RefreshCw,
    credits: "10 Cr.",
  },
  {
    stage: "financials",
    provider: "openregister",
    label: "Finanzdaten abrufen",
    description:
      "Gemeldete Perioden; N/V, wenn OpenRegister keine Daten liefert",
    icon: FileText,
    credits: "10 Cr.",
  },
  {
    stage: "owners",
    provider: "openregister",
    label: "Eigentümer abrufen",
    description: "Gesellschafter und Beteiligungsquoten",
    icon: Users,
    credits: "10 Cr.",
  },
  {
    stage: "website_discovery",
    provider: "tavily",
    label: "Website finden & verifizieren",
    description:
      "Tavily-Kandidat wird mit ID oder mehreren OpenRegister-Profildaten abgeglichen",
    icon: Globe2,
    credits: "bis zu 12 Cr.",
    requiredProviders: ["tavily", "openregister"],
  },
  {
    stage: "apollo_organization",
    provider: "apollo",
    label: "Mit Apollo anreichern",
    description:
      "Geschätzte Beschäftigtenzahl, Umsatz und Unternehmensabgleich",
    icon: Users,
    credits: "1 Cr.",
  },
  {
    stage: "firecrawl_website",
    provider: "firecrawl",
    label: "Unternehmenswebsite analysieren",
    description: "Inhalte der offiziellen Website als Quellenbeleg speichern",
    icon: Globe2,
    credits: "ca. 1–5 Cr.",
  },
  {
    stage: "tavily_research",
    provider: "tavily",
    label: "Web & Nachrichten recherchieren",
    description: "Externe Quellen, Titel, Auszüge und URLs",
    icon: FileSearch,
    credits: "2 Cr.",
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
  const [websiteToast, setWebsiteToast] = useState<WebsiteToast | null>(null);
  useEffect(() => {
    if (!websiteToast) return;
    const timeout = window.setTimeout(() => setWebsiteToast(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [websiteToast]);
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
      website?: string | null;
    };
    if (!response.ok)
      throw new Error(result.error ?? `${stage} ist fehlgeschlagen`);
    return result;
  }

  async function runOne(stage: Stage) {
    setBusy(stage);
    setMessage("");
    if (stage === "website_discovery") setWebsiteToast(null);
    try {
      const action = actions.find((candidate) => candidate.stage === stage);
      const key = `${action?.provider ?? "openregister"}:${stage}`;
      const result = await run(stage, latest.has(key));
      if (stage === "website_discovery") {
        const found = result.available !== false;
        setWebsiteToast({
          kind: found ? "success" : "not-found",
          message: found ? "Website successfully added" : "Website not found",
        });
      }
      setMessage(
        stage === "website_discovery"
          ? ""
          : result.available === false
            ? `${action?.label ?? stage} abgeschlossen, aber der Anbieter hat keine passenden Daten geliefert.`
            : `${action?.label ?? stage} abgeschlossen. Die Ergebnisse wurden unten gespeichert.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Anbieteraktion fehlgeschlagen",
      );
    } finally {
      setBusy(null);
    }
  }

  async function runAll() {
    setBusy("all");
    setMessage("Vollständige OpenRegister-Anreicherung läuft…");
    try {
      for (const action of actions.filter(
        (candidate) => candidate.provider === "openregister",
      ))
        await run(
          action.stage,
          latest.has(`${action.provider}:${action.stage}`),
        );
      setMessage("Vollständige OpenRegister-Anreicherung abgeschlossen.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Vollständige Anreicherung fehlgeschlagen",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      {websiteToast ? (
        <div
          role={websiteToast.kind === "success" ? "status" : "alert"}
          aria-live={websiteToast.kind === "success" ? "polite" : "assertive"}
          className={`fixed right-5 top-5 z-50 flex w-[min(400px,calc(100vw-2.5rem))] items-start gap-3 rounded-xl border p-4 shadow-[0_18px_48px_rgba(20,38,32,0.18)] ${
            websiteToast.kind === "success"
              ? "border-[#8fcab8] bg-[#eaf7f2] text-[#155f4e]"
              : "border-[#e3b49e] bg-[#fff1eb] text-[#8a3f26]"
          }`}
        >
          {websiteToast.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 shrink-0" size={21} />
          ) : (
            <AlertCircle className="mt-0.5 shrink-0" size={21} />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              {websiteToast.message}
            </span>
            <span className="mt-1 block text-xs leading-5 opacity-80">
              {websiteToast.kind === "success"
                ? "The verified website is now visible in the company profile and Apollo is available."
                : "No sufficiently verified company website could be identified."}
            </span>
          </span>
          <button
            type="button"
            aria-label="Close notification"
            onClick={() => setWebsiteToast(null)}
            className="grid size-7 shrink-0 place-items-center rounded-md transition hover:bg-black/5"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}
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
                  {previous ? `${label} erneut ausführen` : label}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-[#75807c]">
                  {description}
                </span>
                {needsWebsite ? (
                  <span className="mt-1 block text-xs font-medium text-[#8b5a2b]">
                    Nicht verfügbar, bis eine verifizierte Website gespeichert
                    ist
                  </span>
                ) : null}
                {previous ? (
                  <span className="mt-1 flex items-center gap-1 text-xs font-medium text-[#31735f]">
                    <CheckCircle2 size={11} /> Letzte Ausführung{" "}
                    {formatRunDate(previous.completedAt)} ·{" "}
                    {previous.available ? "Daten geliefert" : "nicht verfügbar"}
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
          Vollständige Anreicherung · 30 Credits
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
  if (!value) return "erfasst";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
