"use client";

import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  LoaderCircle,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CopilotMode, CopilotRunView } from "@/lib/copilot/types";

const modeOptions: Array<{
  value: CopilotMode;
  label: string;
  hint: string;
}> = [
  { value: "auto", label: "Auto", hint: "Copilot wählt Tiefe und Modell" },
  { value: "quick", label: "Schnell", hint: "Kurze, günstige Recherche" },
  { value: "deep", label: "Tief", hint: "Mehr Suchpfade und Quellen" },
];

const statusCopy: Record<CopilotRunView["status"], string> = {
  queued: "Recherche eingeplant …",
  planning: "Frage und Unternehmenskontext werden analysiert …",
  researching: "Externe Quellen werden recherchiert und geprüft …",
  synthesizing: "Belege werden zu einer Antwort zusammengeführt …",
  completed: "Recherche abgeschlossen",
  failed: "Recherche fehlgeschlagen",
  cancelled: "Recherche abgebrochen",
};

export function CompanyCopilot({
  companyId,
  companyName,
  workspaceId,
  initialRuns,
}: {
  companyId: string;
  companyName: string;
  workspaceId: string;
  initialRuns: CopilotRunView[];
}) {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<CopilotMode>("auto");
  const [runs, setRuns] = useState(initialRuns);
  const [submitting, setSubmitting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(
    initialRuns[0]?.id ?? null,
  );
  const activeIdKey = useMemo(
    () =>
      runs
        .filter(
          (run) => !["completed", "failed", "cancelled"].includes(run.status),
        )
        .map((run) => run.id)
        .join("|"),
    [runs],
  );

  useEffect(() => {
    if (!activeIdKey) return;
    const activeIds = activeIdKey.split("|");
    const timer = window.setInterval(async () => {
      const updates = await Promise.all(
        activeIds.map(async (id) => {
          try {
            const response = await fetch(`/api/copilot/runs/${id}`, {
              headers: { "x-workspace-id": workspaceId },
              cache: "no-store",
            });
            if (!response.ok) return null;
            return ((await response.json()) as { run: CopilotRunView }).run;
          } catch {
            return null;
          }
        }),
      );
      setRuns((current) =>
        current.map(
          (run) => updates.find((item) => item?.id === run.id) ?? run,
        ),
      );
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [activeIdKey, workspaceId]);

  async function startResearch() {
    const trimmed = question.trim();
    if (trimmed.length < 5 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/companies/${companyId}/copilot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId,
        },
        body: JSON.stringify({ question: trimmed, mode }),
      });
      const payload = (await response.json()) as {
        runId?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          payload.error || "Recherche konnte nicht gestartet werden.",
        );
      if (!payload.runId) throw new Error("Die Recherche-ID fehlt.");
      const optimistic: CopilotRunView = {
        id: payload.runId,
        companyId,
        question: trimmed,
        requestedMode: mode,
        resolvedMode: null,
        answerLength: null,
        taskTypes: [],
        status: "queued",
        answer: null,
        answerPayload: {},
        modelRoute: {},
        tokenUsage: {},
        estimatedCostMicros: null,
        latencyMs: null,
        error: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
        sources: [],
      };
      setRuns((current) => [optimistic, ...current]);
      setExpandedId(optimistic.id);
      setQuestion("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Recherche konnte nicht gestartet werden.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteResearch(run: CopilotRunView) {
    const confirmed = window.confirm(
      `Recherche „${run.question}“ endgültig löschen? Die Recherche und ihre gespeicherten Quellen werden entfernt.`,
    );
    if (!confirmed) return;
    setError(null);
    setDeletingIds((current) => new Set(current).add(run.id));
    try {
      const response = await fetch(`/api/copilot/runs/${run.id}`, {
        method: "DELETE",
        headers: { "x-workspace-id": workspaceId },
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          payload.error || "Recherche konnte nicht gelöscht werden.",
        );
      setRuns((current) => current.filter((item) => item.id !== run.id));
      setExpandedId((current) => (current === run.id ? null : current));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Recherche konnte nicht gelöscht werden.",
      );
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(run.id);
        return next;
      });
    }
  }

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-[#bfcfc9] bg-[#f7fbf9] shadow-[0_12px_40px_rgba(20,68,56,.06)]">
      <div className="border-b border-[#d6e2de] bg-[linear-gradient(120deg,#123d33,#176f5b)] px-5 py-5 text-white md:px-7">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <Sparkles size={19} />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Copilot</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-white/70">
              Recherchiert über das Dossier hinaus und nutzt {companyName},
              Registerdaten und vorhandene Belege als Kontext für präzisere
              Suchpfade.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 md:p-7">
        <label
          htmlFor="copilot-question"
          className="text-sm font-semibold text-[#26352f]"
        >
          Was möchten Sie zusätzlich herausfinden?
        </label>
        <textarea
          id="copilot-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter")
              void startResearch();
          }}
          rows={3}
          placeholder="z. B. Welche vergleichbaren Unternehmen gibt es und welche Bruttomargen erzielen sie?"
          className="mt-3 w-full resize-y rounded-xl border border-[#cfd9d5] bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-[#96a09c] focus:border-[#168369] focus:ring-3 focus:ring-[#168369]/10"
        />
        <div className="mt-3 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="inline-flex w-fit rounded-lg border border-[#d2dad7] bg-white p-1">
            {modeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                title={option.hint}
                onClick={() => setMode(option.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${mode === option.value ? "bg-[#dcefe8] text-[#0e654f]" : "text-[#68756f] hover:bg-[#f1f4f2]"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void startResearch()}
            disabled={question.trim().length < 5 || submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#087b62] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#066851] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitting ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <Search size={15} />
            )}
            Recherche starten
          </button>
        </div>
        <p className="mt-2 text-xs text-[#7b8782]">
          ⌘/Ctrl + Enter startet die Recherche. Auto hält die Kosten niedrig,
          wenn eine kurze Suche genügt.
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-[#fff0ed] px-3 py-2 text-sm text-[#a54232]"
          >
            {error}
          </p>
        ) : null}

        {runs.length ? (
          <div className="mt-7 space-y-3 border-t border-[#dce4e1] pt-6">
            <p className="text-xs font-semibold uppercase tracking-[.1em] text-[#70807a]">
              Letzte Recherchen
            </p>
            {runs.map((run) => (
              <RunCard
                key={run.id}
                run={run}
                workspaceId={workspaceId}
                expanded={expandedId === run.id}
                deleting={deletingIds.has(run.id)}
                onToggle={() =>
                  setExpandedId((current) =>
                    current === run.id ? null : run.id,
                  )
                }
                onDelete={() => void deleteResearch(run)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RunCard({
  run,
  workspaceId,
  expanded,
  deleting,
  onToggle,
  onDelete,
}: {
  run: CopilotRunView;
  workspaceId: string;
  expanded: boolean;
  deleting: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const running = !["completed", "failed", "cancelled"].includes(run.status);
  const answer = run.answerPayload;
  return (
    <article className="rounded-xl border border-[#d8dfdc] bg-white">
      <div className="flex items-start">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start justify-between gap-4 px-4 py-4 text-left"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-5 text-[#26322e]">
              {run.question}
            </span>
            <span
              className={`mt-1.5 flex items-center gap-1.5 text-xs ${run.status === "failed" ? "text-[#ad4938]" : "text-[#66736e]"}`}
            >
              {running ? (
                <LoaderCircle
                  size={13}
                  className="animate-spin text-[#087b62]"
                />
              ) : run.status === "completed" ? (
                <Check size={13} className="text-[#087b62]" />
              ) : (
                <Clock3 size={13} />
              )}
              {statusCopy[run.status]}
              {run.resolvedMode ? ` · ${depthLabel(run.resolvedMode)}` : ""}
            </span>
          </span>
          <ChevronDown
            size={16}
            className={`mt-0.5 shrink-0 text-[#71807a] transition ${expanded ? "rotate-180" : ""}`}
          />
        </button>
        {!running ? (
          <button
            type="button"
            aria-label={`Recherche „${run.question}“ löschen`}
            title="Recherche löschen"
            disabled={deleting}
            onClick={onDelete}
            className="mr-3 mt-3 grid size-9 shrink-0 place-items-center rounded-lg text-[#8d5c51] transition hover:bg-[#f9e9e6] hover:text-[#a23f34] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a23f34] disabled:cursor-wait disabled:opacity-45"
          >
            {deleting ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <Trash2 size={15} />
            )}
          </button>
        ) : null}
      </div>
      {expanded ? (
        <div className="border-t border-[#e4e8e6] px-4 py-4 md:px-5">
          {run.status === "completed" ? (
            <>
              {answer.headline ? (
                <h3 className="text-base font-semibold">{answer.headline}</h3>
              ) : null}
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[#40504a]">
                {answer.directAnswer ?? run.answer}
              </p>
              {answer.benchmark ? (
                <BenchmarkTable
                  benchmark={answer.benchmark}
                  sources={run.sources}
                />
              ) : null}
              {answer.sections?.map((section) => (
                <div key={section.title} className="mt-5">
                  <h4 className="text-sm font-semibold">{section.title}</h4>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-7 text-[#4d5c56]">
                    {section.content}
                  </p>
                </div>
              ))}
              {answer.claims?.length ? (
                <div className="mt-5 rounded-xl border border-[#dce4e1] bg-[#f8fbfa] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[.08em] text-[#60736c]">
                    Belegte Aussagen
                  </p>
                  <ul className="mt-3 space-y-3">
                    {answer.claims.map((claim, index) => (
                      <li
                        key={`${claim.text}-${index}`}
                        className="text-sm leading-6 text-[#40504a]"
                      >
                        {claim.text}{" "}
                        <span className="inline-flex gap-1">
                          {claim.sourceUrls.map((url) => {
                            const sourceIndex = run.sources.findIndex(
                              (source) => source.url === url,
                            );
                            return (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-[#087b62] underline underline-offset-2"
                              >
                                [{sourceIndex >= 0 ? sourceIndex + 1 : "Quelle"}
                                ]
                              </a>
                            );
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {answer.contradictions?.length ? (
                <Notice title="Widersprüche" items={answer.contradictions} />
              ) : null}
              {answer.limitations?.length ? (
                <Notice
                  title="Grenzen der Recherche"
                  items={answer.limitations}
                />
              ) : null}
              {run.sources.length ? (
                <div className="mt-5 border-t border-[#e5e8e6] pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[.08em] text-[#70807a]">
                    Zitierte Quellen
                  </p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {run.sources.map((source) => (
                      <a
                        key={source.id}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-w-0 items-start justify-between gap-3 rounded-lg border border-[#e0e5e3] px-3 py-2.5 text-sm transition hover:border-[#8fc7b6] hover:bg-[#f5faf8]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-[#1c5547]">
                            {source.title || new URL(source.url).hostname}
                          </span>
                          <span className="mt-0.5 block text-[11px] uppercase tracking-[.06em] text-[#87918d]">
                            {sourceProviderLabel(source.provider)}
                          </span>
                        </span>
                        <ArrowUpRight
                          size={14}
                          className="mt-0.5 shrink-0 text-[#168369]"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e8e6] pt-3 text-xs text-[#7a8580]">
                <span>{formatRunMeta(run)}</span>
                <Feedback runId={run.id} workspaceId={workspaceId} />
              </div>
            </>
          ) : run.status === "failed" ? (
            <p className="rounded-lg bg-[#fff0ed] px-3 py-2 text-sm text-[#9c3d2e]">
              {run.error || "Die Recherche konnte nicht abgeschlossen werden."}
            </p>
          ) : (
            <div className="flex items-center gap-3 rounded-lg bg-[#edf6f2] px-4 py-3 text-sm text-[#356257]">
              <LoaderCircle size={16} className="animate-spin" />
              {statusCopy[run.status]}
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}

function BenchmarkTable({
  benchmark,
  sources,
}: {
  benchmark: NonNullable<CopilotRunView["answerPayload"]["benchmark"]>;
  sources: CopilotRunView["sources"];
}) {
  const label = benchmarkMetricLabel(benchmark.metric);
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-[#dce4e1]">
      <div className="flex items-center justify-between gap-3 bg-[#f2f8f5] px-4 py-3">
        <p className="text-sm font-semibold text-[#294a40]">
          Vergleichsgruppe · {label}
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${benchmark.observations.length >= 3 ? "bg-[#dcefe8] text-[#0e654f]" : "bg-[#fff0d5] text-[#846216]"}`}
        >
          {benchmark.observations.length >= 3
            ? `${benchmark.observations.length} Unternehmen`
            : "Datenbasis zu klein"}
        </span>
      </div>
      {benchmark.observations.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-y border-[#e3e8e5] bg-white text-xs uppercase tracking-[.05em] text-[#74817c]">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Unternehmen
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Zeitraum
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-right font-semibold"
                >
                  {label}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Quelle
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8ecea] bg-white">
              {benchmark.observations.map((observation) => {
                const source = sources.find(
                  (candidate) => candidate.url === observation.sourceUrl,
                );
                return (
                  <tr key={`${observation.companyName}-${observation.period}`}>
                    <td className="px-4 py-3 align-top">
                      <span className="font-medium text-[#30423b]">
                        {observation.companyName}
                      </span>
                      <span className="mt-0.5 block text-xs text-[#78847f]">
                        {observation.scope}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-[#55635e]">
                      {observation.period}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right align-top font-semibold text-[#263b34]">
                      {observation.valuePercent.toLocaleString("de-DE", {
                        maximumFractionDigits: 1,
                      })}{" "}
                      %
                    </td>
                    <td className="px-4 py-3 align-top">
                      <a
                        href={observation.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={source?.title ?? observation.sourceUrl}
                        className="inline-flex items-center gap-1 font-semibold text-[#087b62] underline underline-offset-2"
                      >
                        {observation.sourceKind === "primary"
                          ? "Primärquelle"
                          : "Sekundärquelle"}
                        <ArrowUpRight size={12} />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="bg-white px-4 py-4 text-sm text-[#68756f]">
          Keine ausreichend vergleichbaren Werte gefunden.
        </p>
      )}
    </div>
  );
}

function benchmarkMetricLabel(
  metric: NonNullable<CopilotRunView["answerPayload"]["benchmark"]>["metric"],
) {
  return {
    gross_margin: "Bruttomarge",
    ebitda_margin: "EBITDA-Marge",
    ebit_margin: "EBIT-Marge",
    operating_margin: "Operative Marge",
    net_margin: "Nettomarge",
  }[metric];
}

function sourceProviderLabel(provider: string) {
  if (provider === "openrouter") return "Web-Recherche";
  if (provider === "stored") return "Dossier";
  return provider;
}

function Feedback({
  runId,
  workspaceId,
}: {
  runId: string;
  workspaceId: string;
}) {
  const [sent, setSent] = useState<boolean | null>(null);
  async function send(helpful: boolean) {
    setSent(helpful);
    await fetch(`/api/copilot/runs/${runId}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": workspaceId,
      },
      body: JSON.stringify({ helpful }),
    }).catch(() => undefined);
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="mr-1">Hilfreich?</span>
      <button
        type="button"
        aria-label="Hilfreich"
        onClick={() => void send(true)}
        className={`rounded-md p-1.5 hover:bg-[#e7f3ef] ${sent === true ? "bg-[#dcefe8] text-[#087b62]" : ""}`}
      >
        <ThumbsUp size={14} />
      </button>
      <button
        type="button"
        aria-label="Nicht hilfreich"
        onClick={() => void send(false)}
        className={`rounded-md p-1.5 hover:bg-[#fff0ed] ${sent === false ? "bg-[#ffe4de] text-[#a54232]" : ""}`}
      >
        <ThumbsDown size={14} />
      </button>
    </span>
  );
}

function Notice({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4 rounded-lg border border-[#eadcb6] bg-[#fffaf0] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[.07em] text-[#7e641f]">
        {title}
      </p>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-[#665b3f]">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function depthLabel(mode: NonNullable<CopilotRunView["resolvedMode"]>) {
  return mode === "quick" ? "Schnell" : mode === "deep" ? "Tief" : "Standard";
}

function formatRunMeta(run: CopilotRunView) {
  const parts = [];
  if (run.sources.length) parts.push(`${run.sources.length} Quellen`);
  if (run.latencyMs) parts.push(`${Math.round(run.latencyMs / 1_000)} s`);
  if (run.estimatedCostMicros !== null)
    parts.push(`ca. $${(run.estimatedCostMicros / 1_000_000).toFixed(4)}`);
  const synthesis = run.modelRoute.synthesis;
  if (typeof synthesis === "string") parts.push(synthesis);
  return parts.join(" · ");
}
