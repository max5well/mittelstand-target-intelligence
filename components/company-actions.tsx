"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, RefreshCw, X } from "lucide-react";
import {
  ProviderLogo,
  providerNames,
  type ProviderId,
} from "@/components/provider-logo";

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
  candidates: number | null;
  rejected: number | null;
};
type WebsiteToast = {
  kind: "success" | "not-found";
};

const actions: Array<{
  stage: Stage;
  provider: ProviderId;
  label: string;
  description: string;
  credits: string;
  displayProviders?: ProviderId[];
  requiredProviders?: ProviderId[];
}> = [
  {
    stage: "details",
    provider: "openregister",
    label: "Profil aktualisieren",
    description: "Adresse, Branche, Unternehmensgegenstand und Management",
    credits: "10 Cr.",
  },
  {
    stage: "financials",
    provider: "openregister",
    label: "Finanzdaten abrufen",
    description:
      "Gemeldete Perioden; N/V, wenn OpenRegister keine Daten liefert",
    credits: "10 Cr.",
  },
  {
    stage: "owners",
    provider: "openregister",
    label: "Eigentümer abrufen",
    description: "Gesellschafter und Beteiligungsquoten",
    credits: "10 Cr.",
  },
  {
    stage: "website_discovery",
    provider: "tavily",
    label: "Website finden & verifizieren",
    description:
      "Tavily zuerst, Firecrawl als Fallback; Abgleich mit mehreren Profildaten",
    credits: "ca. 2–14 Cr.",
    displayProviders: ["tavily", "firecrawl", "openregister"],
  },
  {
    stage: "apollo_organization",
    provider: "apollo",
    label: "Mit Apollo anreichern",
    description:
      "Geschätzte Beschäftigtenzahl, Umsatz und Unternehmensabgleich",
    credits: "1 Cr.",
  },
  {
    stage: "firecrawl_website",
    provider: "firecrawl",
    label: "Unternehmenswebsite analysieren",
    description:
      "Inhalte der offiziellen Website analysieren; nicht als externe Quelle anzeigen",
    credits: "ca. 1–5 Cr. + ≤22k KI-Tokens",
  },
  {
    stage: "tavily_research",
    provider: "tavily",
    label: "Web & Nachrichten recherchieren",
    description:
      "Unabhängige Quellen mit Auszügen; die eigene Domain wird ausgeschlossen",
    credits: "2 Cr. + ≤22k KI-Tokens",
  },
];

export function CompanyActions({
  companyId,
  workspaceId,
  previousRuns,
  availableProviders,
  exhaustedProviders,
  hasWebsite,
  hasOpenRegisterId,
}: {
  companyId: string;
  workspaceId: string;
  previousRuns: PreviousRun[];
  availableProviders: string[];
  exhaustedProviders: string[];
  hasWebsite: boolean;
  hasOpenRegisterId: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Stage | "all" | null>(null);
  const [message, setMessage] = useState("");
  const [completedStages, setCompletedStages] = useState<Set<Stage>>(
    () => new Set(),
  );
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
      (action.stage === "website_discovery"
        ? availableProviders.includes("tavily") ||
          availableProviders.includes("firecrawl")
        : availableProviders.includes(action.provider)) &&
      !(action.stage === "website_discovery" && hasWebsite) &&
      (action.requiredProviders ?? []).every((provider) =>
        availableProviders.includes(provider),
      ) &&
      (action.provider !== "openregister" || hasOpenRegisterId),
  );

  async function run(stage: Stage) {
    const response = await fetch(`/api/companies/${companyId}/enrich`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": workspaceId,
      },
      body: JSON.stringify({ stage }),
    });
    const result = (await response.json()) as {
      error?: string;
      skipped?: boolean;
      available?: boolean;
      website?: string | null;
      candidates?: number;
      rejected?: number;
    };
    if (!response.ok)
      throw new Error(result.error ?? `${stage} ist fehlgeschlagen`);
    return result;
  }

  async function runOne(stage: Stage) {
    const action = actions.find((candidate) => candidate.stage === stage);
    const key = `${action?.provider ?? "openregister"}:${stage}`;
    if (latest.has(key) || completedStages.has(stage)) return;
    setBusy(stage);
    setMessage(
      stage === "website_discovery"
        ? "Website-Suche gestartet. Tavily sucht nach der offiziellen Website und Firecrawl prüft sie bei Bedarf."
        : `${action?.label ?? stage} wurde gestartet…`,
    );
    if (stage === "website_discovery") setWebsiteToast(null);
    try {
      const result = await run(stage);
      if (stage === "website_discovery") {
        const found = result.available !== false;
        setWebsiteToast({ kind: found ? "success" : "not-found" });
        setMessage(
          found
            ? "Website gefunden und verifiziert. Sie wurde dem Unternehmensprofil hinzugefügt."
            : "Suche abgeschlossen. Es konnte keine ausreichend verifizierte Unternehmenswebsite gefunden werden.",
        );
      }
      if (stage !== "website_discovery") {
        const emptyResult =
          result.candidates === 0
            ? "Der Anbieter hat keine Treffer geliefert."
            : result.rejected && result.rejected > 0
              ? `${result.rejected} Treffer wurden wegen fehlender Unternehmensübereinstimmung oder unzureichender Inhalte verworfen.`
              : "Der Anbieter hat keine passenden Daten geliefert.";
        setMessage(
          result.available === false
            ? `${action?.label ?? stage} abgeschlossen. ${emptyResult}`
            : `${action?.label ?? stage} abgeschlossen. Die Ergebnisse wurden unten gespeichert.`,
        );
      }
      setCompletedStages((current) => new Set(current).add(stage));
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
    const remaining = actions.filter(
      (action) =>
        action.provider === "openregister" &&
        !latest.has(`${action.provider}:${action.stage}`) &&
        !completedStages.has(action.stage),
    );
    if (!remaining.length) return;
    setBusy("all");
    setMessage("Vollständige OpenRegister-Anreicherung läuft…");
    try {
      for (const action of remaining) {
        await run(action.stage);
        setCompletedStages((current) => new Set(current).add(action.stage));
      }
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

  const remainingOpenRegisterActions = actions.filter(
    (action) =>
      action.provider === "openregister" &&
      !latest.has(`${action.provider}:${action.stage}`) &&
      !completedStages.has(action.stage),
  ).length;
  const allOpenRegisterActionsCompleted = remainingOpenRegisterActions === 0;

  return (
    <div className="mt-4 space-y-2">
      {exhaustedProviders.length ? (
        <p
          role="alert"
          className="rounded-lg border border-[#e3b49e] bg-[#fff1eb] p-3 text-sm text-[#8a3f26]"
        >
          Provider-Guthaben erschöpft:{" "}
          {exhaustedProviders
            .map(
              (provider) => providerNames[provider as ProviderId] ?? provider,
            )
            .join(", ")}
          . Aktionen bleiben für einen Verbindungstest verfügbar.
        </p>
      ) : null}
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
              {websiteToast.kind === "success"
                ? "Website gefunden"
                : "Keine Website gefunden"}
            </span>
            <span className="mt-1 block text-xs leading-5 opacity-80">
              {websiteToast.kind === "success"
                ? "Die verifizierte Website ist jetzt im Unternehmensprofil sichtbar."
                : "Es konnte keine ausreichend verifizierte Unternehmenswebsite ermittelt werden."}
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
        ({
          stage,
          provider,
          label,
          description,
          credits,
          displayProviders,
        }) => {
          const previous = latest.get(`${provider}:${stage}`);
          const completed = Boolean(previous) || completedStages.has(stage);
          const isRunning = busy === stage;
          const shownProviders = displayProviders ?? [provider];
          const needsWebsite =
            (provider === "apollo" || provider === "firecrawl") && !hasWebsite;
          return (
            <button
              key={stage}
              type="button"
              disabled={busy !== null || needsWebsite || completed}
              onClick={() => runOne(stage)}
              aria-busy={isRunning}
              className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
                isRunning
                  ? "cursor-wait border-[#6db69f] bg-[#eef8f4] shadow-[0_0_0_2px_rgba(19,116,95,0.08)]"
                  : completed
                    ? "cursor-not-allowed border-[#dddcd7] bg-[#efefec] text-[#77807c]"
                    : "border-[#d8d5cc] bg-white hover:border-[#9fc9bc]"
              } disabled:hover:border-[#dddcd7]`}
            >
              <span className="relative flex shrink-0 -space-x-2 py-1">
                {shownProviders.map((shownProvider) => (
                  <ProviderLogo
                    key={shownProvider}
                    provider={shownProvider}
                    muted={completed}
                    size={shownProviders.length > 1 ? "small" : "default"}
                  />
                ))}
                {busy === stage ? (
                  <span className="absolute inset-0 grid place-items-center rounded-lg bg-white/80">
                    <RefreshCw
                      aria-label="Aktion läuft"
                      size={17}
                      className="animate-spin text-[#13745f]"
                    />
                  </span>
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-[10px] font-bold uppercase tracking-[.11em] ${completed ? "text-[#8a928e]" : "text-[#13745f]"}`}
                >
                  {shownProviders
                    .map((shownProvider) => providerNames[shownProvider])
                    .join(" · ")}
                </span>
                <span className="mt-0.5 block text-sm font-semibold">
                  {isRunning
                    ? stage === "website_discovery"
                      ? "Website-Suche läuft…"
                      : `${label} läuft…`
                    : label}
                </span>
                {isRunning ? (
                  <span
                    role="status"
                    aria-live="polite"
                    className="mt-1.5 flex items-start gap-1.5 text-xs font-medium leading-5 text-[#276b5b]"
                  >
                    <RefreshCw
                      aria-hidden="true"
                      size={12}
                      className="mt-1 shrink-0 animate-spin"
                    />
                    {stage === "website_discovery"
                      ? "Tavily sucht und verifiziert Treffer. Das kann bis zu einer Minute dauern."
                      : "Die Anfrage wurde gestartet. Ergebnisse werden nach Abschluss geladen."}
                  </span>
                ) : (
                  <span className="mt-0.5 block text-xs leading-5 text-[#75807c]">
                    {description}
                  </span>
                )}
                {needsWebsite ? (
                  <span className="mt-1 block text-xs font-medium text-[#8b5a2b]">
                    Nicht verfügbar, bis eine verifizierte Website gespeichert
                    ist
                  </span>
                ) : null}
                {completed ? (
                  <span className="mt-1 flex items-center gap-1 text-xs font-medium text-[#66716d]">
                    <CheckCircle2 size={11} /> Abgeschlossen
                    {previous
                      ? ` ${formatRunDate(previous.completedAt)} · ${formatRunOutcome(previous)}`
                      : " · Ergebnisse werden geladen"}
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
      {availableProviders.includes("openregister") && hasOpenRegisterId ? (
        <button
          type="button"
          disabled={busy !== null || allOpenRegisterActionsCompleted}
          onClick={runAll}
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#15352e] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#d8d9d5] disabled:text-[#737b77]"
        >
          <RefreshCw
            size={14}
            className={busy === "all" ? "animate-spin" : ""}
          />
          {allOpenRegisterActionsCompleted
            ? "OpenRegister-Anreicherung abgeschlossen"
            : `Verbleibende OpenRegister-Aktionen · ${remainingOpenRegisterActions * 10} Credits`}
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

function formatRunOutcome(run: PreviousRun) {
  if (run.available) return "Daten geliefert";
  if (run.candidates === 0) return "keine Treffer vom Anbieter";
  if (run.candidates && run.rejected === run.candidates)
    return `${run.candidates} Treffer verworfen`;
  return "keine passenden Quellen";
}
