"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import {
  submitHumanReview,
  type EvalReviewState,
} from "@/app/(dashboard)/evals/actions";

const initialState: EvalReviewState = { ok: false, message: "" };

export function EvalReviewForm({
  runs,
}: {
  runs: Array<{ id: string; user_question: string; status: string }>;
}) {
  const [state, action, pending] = useActionState(
    submitHumanReview,
    initialState,
  );
  const completed = runs.filter((run) => run.status === "completed");
  return (
    <form
      action={action}
      className="rounded-2xl border-2 border-[#e0b957] bg-[#fffaf0] p-5 md:p-6"
    >
      <p className="text-xs font-bold uppercase tracking-[.1em] text-[#8a6511]">
        Dein Input
      </p>
      <h2 className="mt-1 text-lg font-semibold">
        Menschliche Qualitätsprüfung
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#6c6043]">
        Bewerte echte Antworten. Besonders wichtig sind falsche Rechtsträger,
        unbelegte Zahlen und Quellen, die die Aussage nicht tragen.
      </p>
      <label className="mt-5 block text-xs font-semibold text-[#564c35]">
        Copilot-Lauf
        <select
          name="runId"
          required
          className="mt-1.5 w-full rounded-lg border border-[#d9cba9] bg-white px-3 py-2.5 text-sm"
        >
          <option value="">Lauf auswählen …</option>
          {completed.map((run) => (
            <option key={run.id} value={run.id}>
              {run.user_question}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          ["correctness", "Korrektheit"],
          ["researchQuality", "Recherchequalität"],
          ["citationQuality", "Quellenqualität"],
          ["usefulness", "Nützlichkeit"],
        ].map(([name, label]) => (
          <label key={name} className="text-xs font-semibold text-[#564c35]">
            {label} (1–5)
            <select
              name={name}
              defaultValue=""
              required
              className="mt-1.5 w-full rounded-lg border border-[#d9cba9] bg-white px-3 py-2.5 text-sm"
            >
              <option value="" disabled>
                Bitte wählen
              </option>
              {[1, 2, 3, 4, 5].map((score) => (
                <option key={score} value={score}>
                  {score}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <label className="mt-4 block text-xs font-semibold text-[#564c35]">
        Gesamturteil
        <select
          name="verdict"
          defaultValue=""
          required
          className="mt-1.5 w-full rounded-lg border border-[#d9cba9] bg-white px-3 py-2.5 text-sm"
        >
          <option value="" disabled>
            Bitte wählen
          </option>
          <option value="pass">Bestanden</option>
          <option value="partial">Teilweise bestanden</option>
          <option value="fail">Nicht bestanden</option>
        </select>
      </label>
      <label className="mt-4 block text-xs font-semibold text-[#564c35]">
        Begründung / beobachteter Fehler
        <textarea
          name="notes"
          rows={3}
          className="mt-1.5 w-full rounded-lg border border-[#d9cba9] bg-white px-3 py-2.5 text-sm"
          placeholder="Was war gut, falsch oder unvollständig?"
        />
      </label>
      <label className="mt-4 flex items-start gap-2 text-sm text-[#5e543c]">
        <input
          name="addToDataset"
          type="checkbox"
          className="mt-1 accent-[#8a6511]"
        />
        Diesen Lauf als dauerhaften Regressionstest in „Copilot Praxisfälle“
        aufnehmen
      </label>
      <div className="mt-5 flex items-center justify-between gap-3">
        <span
          role="status"
          className={`text-sm ${state.ok ? "text-[#13745f]" : "text-[#9d4334]"}`}
        >
          {state.message}
        </span>
        <button
          disabled={pending || !completed.length}
          className="inline-flex items-center gap-2 rounded-lg bg-[#7a5b10] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-45"
        >
          <Send size={14} /> {pending ? "Speichert …" : "Bewertung speichern"}
        </button>
      </div>
    </form>
  );
}
