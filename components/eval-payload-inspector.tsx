"use client";

import { Braces, Check, Copy, LoaderCircle } from "lucide-react";
import { useState } from "react";
import {
  loadCopilotPayloads,
  type EvalPayloadState,
} from "@/app/(dashboard)/evals/actions";

type EvalRunOption = {
  id: string;
  question: string;
  status: string;
  createdAt: string;
};

const stageLabels: Record<string, string> = {
  research_plan: "Rechercheplanung",
  answer_synthesis: "Antwortsynthese",
  llm_judge: "LLM-Judge",
};

export function EvalPayloadInspector({ runs }: { runs: EvalRunOption[] }) {
  const [selectedRunId, setSelectedRunId] = useState("");
  const [result, setResult] = useState<EvalPayloadState | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedSequence, setCopiedSequence] = useState<number | null>(null);

  async function selectRun(runId: string) {
    setSelectedRunId(runId);
    setResult(null);
    setCopiedSequence(null);
    if (!runId) return;
    setLoading(true);
    const loaded = await loadCopilotPayloads(runId);
    setResult(loaded);
    setLoading(false);
  }

  async function copyPayload(sequence: number, payload: unknown) {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedSequence(sequence);
    window.setTimeout(() => setCopiedSequence(null), 1_500);
  }

  return (
    <section className="mt-7 overflow-hidden rounded-2xl border border-[#d7d8d2] bg-[#faf9f6]">
      <div className="flex flex-col justify-between gap-4 border-b border-[#dedfd9] px-5 py-5 md:flex-row md:items-center md:px-7">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-[#dcefe8] text-[#13745f]">
            <Braces size={17} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold">Tatsächliche LLM-Payloads</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#68736e]">
              Zeigt den final serialisierten JSON-Body jeder Copilot-Anfrage an
              OpenRouter – inklusive System-Prompt, Nutzer-Payload,
              Antwortschema und Modellparametern. HTTP-Header und API-Schlüssel
              werden nicht gespeichert.
            </p>
          </div>
        </div>
        <label className="w-full shrink-0 text-xs font-semibold text-[#53605b] md:w-[390px]">
          Copilot-Lauf
          <select
            value={selectedRunId}
            onChange={(event) => void selectRun(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[#cfd4d1] bg-white px-3 py-2.5 text-sm font-normal"
          >
            <option value="">Lauf auswählen …</option>
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {new Date(run.createdAt).toLocaleString("de-DE")} ·{" "}
                {run.question}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="p-5 md:p-7">
        {loading ? (
          <div
            role="status"
            className="flex items-center gap-2 text-sm text-[#68736e]"
          >
            <LoaderCircle size={15} className="animate-spin" /> Payloads werden
            geladen …
          </div>
        ) : null}
        {result && !result.ok ? (
          <p role="alert" className="text-sm text-[#9d4334]">
            {result.message}
          </p>
        ) : null}
        {result?.ok && !result.traces.length ? (
          <p className="text-sm text-[#68736e]">
            Für diesen Lauf wurde noch keine LLM-Anfrage aufgezeichnet.
          </p>
        ) : null}
        {result?.ok && result.traces.length ? (
          <div className="space-y-3">
            {result.traces.map((trace, index) => {
              const exactPayload = isExactRequestPayload(trace.inputSnapshot);
              return (
                <details
                  key={`${trace.sequence}-${trace.eventType}`}
                  open={index === 0}
                  className="group rounded-xl border border-[#dcded9] bg-white"
                >
                  <summary className="cursor-pointer list-none px-4 py-4 marker:hidden">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div>
                        <span className="text-sm font-semibold">
                          {stageLabels[trace.eventType] ?? trace.eventType}
                        </span>
                        <span className="ml-2 rounded-full bg-[#edf2ef] px-2 py-1 text-[11px] font-medium text-[#53605b]">
                          {trace.model}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-semibold ${exactPayload ? "text-[#13745f]" : "text-[#8a6511]"}`}
                      >
                        {exactPayload
                          ? "Exakter Request-Body"
                          : "Historischer Eingabe-Snapshot"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[#7a8580]">
                      {trace.provider ?? "Provider nicht erfasst"} · Sequenz{" "}
                      {trace.sequence}
                      {trace.promptVersion ? ` · ${trace.promptVersion}` : ""}
                      {trace.durationMs == null
                        ? ""
                        : ` · ${trace.durationMs} ms`}
                    </p>
                  </summary>
                  <div className="border-t border-[#e3e4df] p-4">
                    {!exactPayload ? (
                      <p className="mb-3 rounded-lg bg-[#fff6df] px-3 py-2 text-xs leading-5 text-[#765b1d]">
                        Dieser ältere Lauf enthält den fachlichen Input, aber
                        noch nicht den finalen OpenRouter-Request. Neue Läufe
                        werden vollständig erfasst.
                      </p>
                    ) : null}
                    <div className="mb-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          void copyPayload(trace.sequence, trace.inputSnapshot)
                        }
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#d5d9d6] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#52605a] hover:bg-[#f4f5f2]"
                      >
                        {copiedSequence === trace.sequence ? (
                          <Check size={13} aria-hidden="true" />
                        ) : (
                          <Copy size={13} aria-hidden="true" />
                        )}
                        {copiedSequence === trace.sequence
                          ? "Kopiert"
                          : "JSON kopieren"}
                      </button>
                    </div>
                    <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[#15201d] p-4 text-xs leading-5 text-[#dce7e2]">
                      {JSON.stringify(trace.inputSnapshot, null, 2)}
                    </pre>
                  </div>
                </details>
              );
            })}
          </div>
        ) : null}
        {!selectedRunId ? (
          <p className="text-sm text-[#77817d]">
            Wähle einen Lauf aus, um zu prüfen, welche Informationen Copilot an
            das LLM übergeben hat.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function isExactRequestPayload(value: Record<string, unknown>) {
  return typeof value.model === "string" && Array.isArray(value.messages);
}
