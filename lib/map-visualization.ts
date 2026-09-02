import type { Company } from "@/lib/types";

export type MapMode = "status" | "ownership" | "score";

type MapCompany = Pick<Company, "ownership" | "score" | "status">;
type LegendItem = { key: string; label: string; color: string };

export const mapModeConfig: Record<
  MapMode,
  { label: string; description: string; legend: LegendItem[] }
> = {
  status: {
    label: "Status",
    description: "Farbe nach dem häufigsten Pipeline-Status je Standort",
    legend: [
      { key: "shortlist", label: "Shortlist", color: "#08a77c" },
      { key: "active", label: "Aktiver Prozess", color: "#327187" },
      { key: "early", label: "Neu / geprüft", color: "#5b8f82" },
      { key: "closed", label: "Ausgeschieden", color: "#7f8b86" },
    ],
  },
  ownership: {
    label: "Eigentümer",
    description: "Farbe nach der häufigsten Eigentümergruppe je Standort",
    legend: [
      {
        key: "owner-led",
        label: "Inhaber / Familie",
        color: "#1f9d7a",
      },
      { key: "pe", label: "PE / Finanzinvestor", color: "#8065b0" },
      {
        key: "strategic",
        label: "Strategisch / öffentlich",
        color: "#477b8c",
      },
      { key: "other", label: "Sonstige / unbekannt", color: "#89928e" },
    ],
  },
  score: {
    label: "Score",
    description: "Farbe nach dem durchschnittlichen Score je Standort",
    legend: [
      { key: "high", label: "80–100", color: "#10a77f" },
      { key: "medium", label: "65–79", color: "#d6a936" },
      { key: "low", label: "Unter 65", color: "#c06a52" },
      { key: "none", label: "Kein Score", color: "#89928e" },
    ],
  },
};

export function getMarkerPresentation(companies: MapCompany[], mode: MapMode) {
  const config = mapModeConfig[mode];
  if (mode === "score") {
    const scores = companies.flatMap((company) =>
      company.score === null ? [] : [company.score],
    );
    if (!scores.length) return presentation(config.legend, "none");
    const average =
      scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const key = average >= 80 ? "high" : average >= 65 ? "medium" : "low";
    const result = presentation(config.legend, key);
    return { ...result, detail: `Ø ${Math.round(average)}` };
  }

  const category = dominantCategory(
    companies.map((company) =>
      mode === "ownership"
        ? ownershipCategory(company.ownership)
        : statusCategory(company.status),
    ),
    config.legend.map((item) => item.key),
  );
  return presentation(config.legend, category);
}

function presentation(legend: LegendItem[], key: string) {
  const item = legend.find((candidate) => candidate.key === key) ?? legend[0];
  return { color: item.color, label: item.label, detail: item.label };
}

function dominantCategory(categories: string[], priority: string[]) {
  const counts = new Map<string, number>();
  for (const category of categories)
    counts.set(category, (counts.get(category) ?? 0) + 1);
  return priority.reduce((selected, candidate) =>
    (counts.get(candidate) ?? 0) > (counts.get(selected) ?? 0)
      ? candidate
      : selected,
  );
}

function statusCategory(status: Company["status"]) {
  if (status === "shortlisted") return "shortlist";
  if (
    [
      "outreach_planned",
      "contacted",
      "in_conversation",
      "nda",
      "diligence",
      "loi",
    ].includes(status)
  )
    return "active";
  if (status === "passed" || status === "archived") return "closed";
  return "early";
}

function ownershipCategory(ownership: Company["ownership"]) {
  if (
    ownership === "Family-owned" ||
    ownership === "Founder/individual-owned" ||
    ownership === "Owner-managed"
  )
    return "owner-led";
  if (ownership === "PE-backed or financial-sponsor-owned") return "pe";
  if (
    ownership === "Corporate/strategic-owned" ||
    ownership === "Holding-company-owned" ||
    ownership === "Publicly listed" ||
    ownership === "State/municipal-owned"
  )
    return "strategic";
  return "other";
}
