"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEvalAdmin } from "@/lib/auth/evals";
import { createAdminClient } from "@/lib/db/admin";

export type EvalReviewState = { ok: boolean; message: string };

const ReviewSchema = z.object({
  runId: z.string().uuid(),
  verdict: z.enum(["pass", "partial", "fail"]),
  correctness: z.coerce.number().int().min(1).max(5),
  researchQuality: z.coerce.number().int().min(1).max(5),
  citationQuality: z.coerce.number().int().min(1).max(5),
  usefulness: z.coerce.number().int().min(1).max(5),
  notes: z.string().trim().max(3_000),
  addToDataset: z.boolean(),
});

export async function submitHumanReview(
  _previous: EvalReviewState,
  formData: FormData,
): Promise<EvalReviewState> {
  const user = await requireEvalAdmin();
  const parsed = ReviewSchema.safeParse({
    runId: formData.get("runId"),
    verdict: formData.get("verdict"),
    correctness: formData.get("correctness"),
    researchQuality: formData.get("researchQuality"),
    citationQuality: formData.get("citationQuality"),
    usefulness: formData.get("usefulness"),
    notes: formData.get("notes") ?? "",
    addToDataset: formData.get("addToDataset") === "on",
  });
  if (!parsed.success)
    return {
      ok: false,
      message: "Bitte alle Bewertungsfelder vollständig ausfüllen.",
    };
  const supabase = createAdminClient();
  const { data: run, error: runError } = await supabase
    .from("copilot_research_runs")
    .select("id,company_id,user_question,requested_mode,answer_payload")
    .eq("workspace_id", user.workspaceId)
    .eq("id", parsed.data.runId)
    .maybeSingle();
  if (runError || !run)
    return { ok: false, message: "Der ausgewählte Lauf wurde nicht gefunden." };
  const { error } = await supabase.from("eval_results").insert({
    workspace_id: user.workspaceId,
    research_run_id: run.id,
    stage: "human_review",
    evaluator_type: "human",
    evaluator_model: null,
    verdict: parsed.data.verdict,
    scores: {
      correctness: parsed.data.correctness / 5,
      researchQuality: parsed.data.researchQuality / 5,
      citationQuality: parsed.data.citationQuality / 5,
      usefulness: parsed.data.usefulness / 5,
    },
    reasoning: parsed.data.notes || null,
    reviewed_by: user.id,
  });
  if (error) return { ok: false, message: error.message };

  if (parsed.data.addToDataset) {
    const { data: dataset, error: datasetError } = await supabase
      .from("eval_datasets")
      .upsert(
        {
          workspace_id: user.workspaceId,
          name: "Copilot Praxisfälle",
          description:
            "Aus echten Copilot-Nutzungen kuratierte Fälle für Regressionstests.",
          status: "active",
          created_by: user.id,
        },
        { onConflict: "workspace_id,name" },
      )
      .select("id")
      .single();
    if (datasetError) return { ok: false, message: datasetError.message };
    const { error: caseError } = await supabase.from("eval_cases").insert({
      workspace_id: user.workspaceId,
      dataset_id: dataset.id,
      company_id: run.company_id,
      source_run_id: run.id,
      question: run.user_question,
      research_mode: run.requested_mode,
      rubric: {
        dimensions: [
          "correctness",
          "researchQuality",
          "citationQuality",
          "usefulness",
        ],
      },
      expected_behaviors: [
        "Answer the exact question",
        "Cite support for external claims",
        "Expose uncertainty",
      ],
      critical_failures: [
        "Wrong legal entity",
        "Fabricated evidence",
        "Unsupported financial figure",
      ],
      evidence_snapshot: { answer: run.answer_payload },
      created_by: user.id,
    });
    if (caseError && caseError.code !== "23505")
      return { ok: false, message: caseError.message };
  }
  revalidatePath("/evals");
  return { ok: true, message: "Bewertung gespeichert." };
}
