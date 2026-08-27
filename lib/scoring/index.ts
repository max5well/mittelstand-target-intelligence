import { z } from "zod";

export const ScoreWeightsSchema = z
  .object({
    financial: z.number().nonnegative(),
    size: z.number().nonnegative(),
    ownership: z.number().nonnegative(),
    succession: z.number().nonnegative(),
    industry: z.number().nonnegative(),
    dataQuality: z.number().nonnegative(),
  })
  .refine(
    (value) =>
      Object.values(value).reduce((sum, weight) => sum + weight, 0) === 100,
    "Score weights must total 100",
  );
export const defaultWeights = ScoreWeightsSchema.parse({
  financial: 30,
  size: 20,
  ownership: 20,
  succession: 15,
  industry: 10,
  dataQuality: 5,
});

export type ScoreInput = {
  revenueCents: number | null;
  ebitdaCents: number | null;
  employees: number | null;
  ownershipFit: number | null;
  successionSignal: boolean | null;
  industryFit: number;
  dataAgeDays: number;
};

export function calculateScore(input: ScoreInput, weights = defaultWeights) {
  if (
    input.revenueCents === null ||
    input.ebitdaCents === null ||
    input.employees === null ||
    input.ownershipFit === null
  )
    return {
      score: null,
      insufficientData: true,
      components: {},
      reasons: [
        "Revenue, EBITDA, employees, and ownership are required for a fair score.",
      ],
    };
  const revenueEuros = input.revenueCents / 100;
  const margin = input.ebitdaCents / input.revenueCents;
  const financial = Math.min(
    1,
    (revenueEuros >= 10_000_000 && revenueEuros <= 80_000_000 ? 0.55 : 0.25) +
      Math.min(0.45, margin / 0.35),
  );
  const size =
    input.employees >= 50 && input.employees <= 250
      ? 1
      : input.employees >= 25 && input.employees <= 400
        ? 0.55
        : 0.2;
  const components = {
    financial: Math.round(financial * weights.financial),
    size: Math.round(size * weights.size),
    ownership: Math.round(input.ownershipFit * weights.ownership),
    succession: input.successionSignal ? weights.succession : 0,
    industry: Math.round(input.industryFit * weights.industry),
    dataQuality: Math.round(
      (input.dataAgeDays <= 90 ? 1 : input.dataAgeDays <= 180 ? 0.5 : 0.1) *
        weights.dataQuality,
    ),
  };
  return {
    score: Object.values(components).reduce((sum, value) => sum + value, 0),
    insufficientData: false,
    components,
    reasons: [
      `EBITDA margin ${(margin * 100).toFixed(1)}%`,
      `${input.employees} reported employees`,
      input.successionSignal
        ? "Evidence-backed succession signal"
        : "No succession signal",
      `Data age ${input.dataAgeDays} days`,
    ],
  };
}
