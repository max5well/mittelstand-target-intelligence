import { CircleHelp, FlaskConical, Gauge, ShieldCheck } from "lucide-react";
import { EvalReviewForm } from "@/components/eval-review-form";
import { EvalPayloadInspector } from "@/components/eval-payload-inspector";
import { PageHeader } from "@/components/app-shell";
import { requireEvalAdmin } from "@/lib/auth/evals";
import { getEvalConsoleData } from "@/lib/data/copilot";
import { copilotModels } from "@/lib/integrations/openrouter/generate";

export const dynamic = "force-dynamic";

export default async function EvalConsolePage() {
  const user = await requireEvalAdmin();
  const data = await getEvalConsoleData(user.workspaceId);
  const completed = data.runs.filter((run) => run.status === "completed");
  const failed = data.runs.filter((run) => run.status === "failed");
  const llmResults = data.results.filter(
    (result) => result.evaluator_type === "llm",
  );
  const passRate = llmResults.length
    ? Math.round(
        (llmResults.filter((result) => result.verdict === "pass").length /
          llmResults.length) *
          100,
      )
    : null;

  return (
    <div className="mx-auto max-w-[1500px] p-5 md:p-9">
      <PageHeader
        eyebrow="Nur für Eval-Admin"
        title="Eval Console"
        description="Verstehe, teste und verbessere Copilot systematisch – mit echten Nutzungsdaten, automatischen Checks, LLM-as-a-Judge und deiner eigenen Bewertung."
      />

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric
          label="Copilot-Läufe"
          value={data.runs.length}
          hint="Alle gespeicherten Fragen im aktuellen Workspace."
        />
        <Metric
          label="Abgeschlossen"
          value={completed.length}
          hint="Läufe mit einer ausgelieferten Antwort."
        />
        <Metric
          label="Fehler"
          value={failed.length}
          hint="Technisch oder wegen fehlender belastbarer Evidenz gescheiterte Läufe."
        />
        <Metric
          label="Judge Pass Rate"
          value={passRate === null ? "—" : `${passRate}%`}
          hint="Anteil der LLM-Judgments mit Gesamturteil 'bestanden'."
        />
      </section>

      <section className="mt-7 rounded-2xl border border-[#d7d8d2] bg-[#faf9f6] p-5 md:p-7">
        <div className="flex items-center gap-2">
          <FlaskConical size={18} className="text-[#13745f]" />
          <h2 className="text-lg font-semibold">
            So funktioniert die Auswertung
          </h2>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-4">
          <Stage
            number="1"
            title="Deterministische Checks"
            owner="Code"
            text="Prüft u. a. gültige Quellen-URLs, Beleganzahl, Laufzeit und vollständige Ausgabe."
          />
          <Stage
            number="2"
            title="LLM-as-a-Judge"
            owner={copilotModels.judge}
            text="Bewertet Grounding, Vollständigkeit, Fragenbezug und passende Recherche-Tiefe gegen die gespeicherten Belege."
          />
          <Stage
            number="3"
            title="Human Review"
            owner="Du"
            text="Kontrolliert, was automatisierte Judges nur schwer erkennen: echte Nützlichkeit, Nuancen und Investment-Relevanz."
          />
          <Stage
            number="4"
            title="Regressionen"
            owner="Datensatz"
            text="Gute und schwierige Praxisfälle werden wiederholt gegen neue Prompts und Modelle getestet."
          />
        </div>
        <p className="mt-4 rounded-lg bg-[#edf5f1] px-4 py-3 text-xs leading-5 text-[#49645b]">
          Judge-Routing: Standardmäßig {copilotModels.judge}; wenn dieses Modell
          selbst die Antwort erzeugt hat, übernimmt zur Unabhängigkeit{" "}
          {copilotModels.adjudicator}. Modelle sind per Umgebungsvariable
          austauschbar.
        </p>
      </section>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.45fr_.75fr]">
        <section className="overflow-hidden rounded-2xl border border-[#d7d8d2] bg-[#faf9f6]">
          <div className="flex items-center justify-between gap-3 border-b border-[#dedfd9] px-5 py-4">
            <div>
              <h2 className="font-semibold">Echte Copilot-Läufe</h2>
              <p className="mt-1 text-xs text-[#77817d]">
                Fragen, Routing und Qualitätsurteile aus der App
              </p>
            </div>
            <Gauge size={18} className="text-[#13745f]" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f1f0eb] text-xs uppercase tracking-[.06em] text-[#68736e]">
                <tr>
                  <Column
                    label="Frage"
                    help="Die ursprüngliche, unveränderte Nutzereingabe."
                  />
                  <Column
                    label="Klasse"
                    help="Vom Router erkannte Aufgabentypen; damit erkennst du die wichtigsten Use Cases."
                  />
                  <Column
                    label="Tiefe"
                    help="Angefragter Modus → tatsächlich gewählte Recherche-Tiefe."
                  />
                  <Column
                    label="Status"
                    help="Technischer Endzustand des Forschungsablaufs."
                  />
                  <Column
                    label="Modelle"
                    help="Die tatsächlich verwendeten Modelle werden pro Lauf gespeichert."
                  />
                  <Column
                    label="Kosten"
                    help="Bekannte Provider- und Modellkosten; einige Provider liefern keine USD-Kosten."
                  />
                  <Column
                    label="Eval"
                    help="Letztes verfügbares automatisches oder menschliches Gesamturteil."
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e3de]">
                {data.runs.map((run) => {
                  const result = data.results.find(
                    (item) => item.research_run_id === run.id,
                  );
                  const route = run.model_route as Record<string, unknown>;
                  return (
                    <tr key={run.id} className="align-top">
                      <td className="max-w-[330px] px-4 py-4 font-medium leading-5">
                        {run.user_question}
                      </td>
                      <td className="px-4 py-4 text-xs text-[#5e6a65]">
                        {(run.task_types as string[]).join(", ") || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs">
                        {run.requested_mode} → {run.resolved_mode ?? "—"}
                      </td>
                      <td className="px-4 py-4">
                        <Status value={run.status as string} />
                      </td>
                      <td className="max-w-[220px] px-4 py-4 text-xs text-[#5e6a65]">
                        {[route.planner, route.synthesis]
                          .filter(Boolean)
                          .join(" → ") || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs">
                        {run.estimated_cost_micros == null
                          ? "—"
                          : `$${(Number(run.estimated_cost_micros) / 1_000_000).toFixed(4)}`}
                      </td>
                      <td className="px-4 py-4">
                        <Verdict
                          value={result?.verdict as string | undefined}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!data.runs.length ? (
            <p className="p-6 text-sm text-[#77817d]">
              Noch keine Copilot-Läufe. Stelle auf einer Unternehmensseite die
              erste Frage.
            </p>
          ) : null}
        </section>

        <div className="space-y-6">
          <EvalReviewForm
            runs={data.runs.map((run) => ({
              id: run.id as string,
              user_question: run.user_question as string,
              status: run.status as string,
            }))}
          />
          <section className="rounded-2xl border border-[#d7d8d2] bg-[#faf9f6] p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} className="text-[#13745f]" />
              <h2 className="font-semibold">Datensätze</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#68736e]">
              Ein Datensatz ist eine feste Sammlung repräsentativer Fragen. Er
              macht Prompt- oder Modelländerungen vergleichbar.
            </p>
            <div className="mt-4 space-y-2">
              {data.datasets.map((dataset) => (
                <div
                  key={dataset.id}
                  className="rounded-lg border border-[#e0e0da] bg-white px-3 py-3"
                >
                  <p className="text-sm font-semibold">{dataset.name}</p>
                  <p className="mt-1 text-xs text-[#7a8580]">
                    {
                      data.cases.filter(
                        (item) => item.dataset_id === dataset.id,
                      ).length
                    }{" "}
                    Fälle · {dataset.status}
                  </p>
                </div>
              ))}
              {!data.datasets.length ? (
                <p className="rounded-lg bg-[#f0eee9] px-3 py-3 text-sm text-[#68736e]">
                  Noch kein Datensatz. Aktiviere beim Human Review „als
                  Regressionstest aufnehmen“.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <EvalPayloadInspector
        runs={data.runs.map((run) => ({
          id: run.id as string,
          question: run.user_question as string,
          status: run.status as string,
          createdAt: run.created_at as string,
        }))}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-[#d7d8d2] bg-[#faf9f6] p-5">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[.07em] text-[#75807c]">
        {label}
        <span title={hint} aria-label={hint} tabIndex={0}>
          <CircleHelp size={13} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Stage({
  number,
  title,
  owner,
  text,
}: {
  number: string;
  title: string;
  owner: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-[#dfe2de] bg-white p-4">
      <span className="grid size-7 place-items-center rounded-full bg-[#dcefe8] text-xs font-bold text-[#087b62]">
        {number}
      </span>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-[11px] font-semibold text-[#13745f]">{owner}</p>
      <p className="mt-2 text-xs leading-5 text-[#68736e]">{text}</p>
    </div>
  );
}

function Column({ label, help }: { label: string; help: string }) {
  return (
    <th className="whitespace-nowrap px-4 py-3">
      <span className="inline-flex items-center gap-1.5">
        {label}
        <span title={help} aria-label={help} tabIndex={0}>
          <CircleHelp size={12} aria-hidden="true" />
        </span>
      </span>
    </th>
  );
}

function Status({ value }: { value: string }) {
  const good = value === "completed";
  const bad = value === "failed";
  return (
    <span
      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${good ? "bg-[#e3f2eb] text-[#176b56]" : bad ? "bg-[#fde8e3] text-[#a03e30]" : "bg-[#eeeae0] text-[#6c665b]"}`}
    >
      {value}
    </span>
  );
}

function Verdict({ value }: { value?: string }) {
  if (!value) return <span className="text-xs text-[#929a96]">offen</span>;
  return (
    <span
      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${value === "pass" ? "bg-[#e3f2eb] text-[#176b56]" : value === "fail" ? "bg-[#fde8e3] text-[#a03e30]" : "bg-[#fff0cf] text-[#815e10]"}`}
    >
      {value}
    </span>
  );
}
