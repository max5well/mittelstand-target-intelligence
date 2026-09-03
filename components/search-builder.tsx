"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  CalendarClock,
  Check,
  ChevronDown,
  CirclePause,
  LoaderCircle,
  Play,
  Plus,
  Save,
  Search,
} from "lucide-react";
import { germanStates, registerCourtsForStates } from "@/lib/german-states";
import {
  describeSavedSearch,
  type SavedSearchFilter,
} from "@/lib/search-summary";
import { filterWz2025Industries, wz2025Industries } from "@/lib/wz2025";

const providerCosts = {
  searchRunMaximum: 100,
  previewSearch: 10,
  details: 10,
  financials: 10,
  owners: 10,
  websiteDiscovery: 4,
};

type SearchApiResponse = {
  error?: string;
  pagination?: { total_results?: number; total?: number };
  run?: {
    accepted: number;
    duplicates: number;
    enrichmentCalls: number;
    unavailable: number;
    enrichmentErrors: number;
    websiteDiscoveryCalls: number;
    websitesAdded: number;
    websitesUnavailable: number;
    websiteDiscoveryErrors: number;
    creditsUsed: number;
  } | null;
};

type ExecutionMode = "once" | "recurring";

function parseLocalizedNumber(value: string) {
  const compact = value.trim().replace(/[\s€]/g, "");
  if (!compact) return Number.NaN;

  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(compact))
    return Number(compact.replace(/\./g, "").replace(",", "."));
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(compact))
    return Number(compact.replace(/,/g, ""));

  return Number(compact.replace(",", "."));
}

function formatLocalizedNumber(value: string) {
  const number = parseLocalizedNumber(value);
  if (!Number.isFinite(number)) return value;
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(number);
}

export function SearchBuilder({
  triggerLabel = "Neue Suche erstellen",
  workspaceId,
}: {
  triggerLabel?: string;
  workspaceId: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState<
    "preview" | "save" | "run" | "schedule" | null
  >(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">(
    "info",
  );
  const [dailyTarget, setDailyTarget] = useState(10);
  const [mode, setMode] = useState<"lean" | "full">("full");
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("once");
  const [status, setStatus] = useState<"active" | "all">("all");
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [industryQuery, setIndustryQuery] = useState("");
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedLegalForms, setSelectedLegalForms] = useState<string[]>([]);
  const [requireReportedEbitda, setRequireReportedEbitda] = useState(false);
  const [advancedFinancials, setAdvancedFinancials] = useState(false);
  const dailyCost = useMemo(
    () =>
      providerCosts.searchRunMaximum +
      dailyTarget *
        (providerCosts.details +
          providerCosts.websiteDiscovery +
          (mode === "full"
            ? providerCosts.financials + providerCosts.owners
            : 0)),
    [dailyTarget, mode],
  );
  const industryNames = selectedIndustries
    .map(
      (code) =>
        wz2025Industries.find((industry) => industry.code === code)?.name,
    )
    .filter((name): name is string => Boolean(name));
  const currentSelectionSummary = describeSavedSearch({
    filters: [
      ...(status === "active" ? [{ field: "status", value: "active" }] : []),
      ...(selectedLegalForms.length
        ? [{ field: "legal_form", values: selectedLegalForms }]
        : []),
      ...(selectedIndustries.length
        ? [{ field: "industry_codes", values: selectedIndustries }]
        : []),
    ],
    industryNames,
    states: selectedStates,
  });

  function openBuilder() {
    setDailyTarget(10);
    setMode("full");
    setExecutionMode("once");
    setStatus("all");
    setSelectedIndustries([]);
    setIndustryQuery("");
    setSelectedStates([]);
    setSelectedLegalForms([]);
    setRequireReportedEbitda(false);
    setAdvancedFinancials(false);
    setMessage("");
    setOpen(true);
  }

  function requestBody(runNow: boolean, activateSchedule = false) {
    const form = formRef.current;
    if (!form) throw new Error("Das Suchformular ist nicht verfügbar.");
    const data = new FormData(form);
    const filters: SavedSearchFilter[] = [];
    if (selectedLegalForms.length)
      filters.push({ field: "legal_form", values: selectedLegalForms });
    if (status !== "all") filters.unshift({ field: "status", value: status });
    if (selectedIndustries.length)
      filters.push({ field: "industry_codes", values: selectedIndustries });
    const registerCourts = registerCourtsForStates(selectedStates);
    if (registerCourts.length)
      filters.push({ field: "register_court", values: registerCourts });
    const purposeKeywords = String(data.get("purpose_keywords") ?? "")
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);
    if (purposeKeywords.length)
      filters.push({ field: "purpose", keywords: purposeKeywords });

    const ranges = [
      ["employees", "plain"],
      ["revenue", "money"],
      ["ebitda", "money"],
      ["incorporated_at", "date"],
      ["ebit", "money"],
      ["equity", "money"],
      ["financial_debt", "money"],
      ["balance_sheet_total", "money"],
      ["youngest_owner_age", "plain"],
    ] as const;
    for (const [field, conversion] of ranges) {
      const rawMin = String(data.get(`${field}_min`) ?? "").trim();
      const rawMax = String(data.get(`${field}_max`) ?? "").trim();
      const convert = (value: string) => {
        if (conversion === "money" && value) {
          const amount = parseLocalizedNumber(value);
          return Number.isFinite(amount)
            ? String(Math.round(amount * 100))
            : value;
        }
        if (conversion === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          const [year, month, day] = value.split("-");
          return `${day}-${month}-${year}`;
        }
        return value;
      };
      if (rawMin || rawMax)
        filters.push({
          field,
          ...(rawMin ? { min: convert(rawMin) } : {}),
          ...(rawMax ? { max: convert(rawMax) } : {}),
        });
    }
    for (const field of data.getAll("ownership_filter")) {
      filters.push({
        field: String(field),
        value: field === "has_open_insolvency" ? "false" : "true",
      });
    }
    return {
      name: String(data.get("name") ?? "").trim(),
      description: String(data.get("description") ?? "").trim(),
      summary: describeSavedSearch({
        filters,
        industryNames,
        states: selectedStates,
      }),
      filters,
      hydrationMode: mode,
      dailyTarget,
      scheduleTime:
        executionMode === "recurring"
          ? String(data.get("schedule_time") ?? "06:30")
          : undefined,
      active: executionMode === "recurring" && activateSchedule,
      runNow,
    };
  }

  async function previewCount() {
    setBusy(true);
    setActiveAction("preview");
    setMessageTone("info");
    setMessage("Live-Trefferzahl bei OpenRegister wird geprüft…");
    try {
      const body = requestBody(false);
      const response = await fetch("/api/providers/openregister/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId,
        },
        body: JSON.stringify({
          filters: body.filters,
          pagination: { page: 1, per_page: 1 },
        }),
      });
      const result = (await response.json()) as SearchApiResponse;
      if (!response.ok)
        throw new Error(result.error ?? "Vorschau fehlgeschlagen");
      const total =
        result.pagination?.total_results ?? result.pagination?.total ?? 0;
      setMessageTone("success");
      setMessage(
        `${Number(total).toLocaleString("de-DE")} passende Unternehmen laut OpenRegister${selectedLegalForms.includes("kg") ? "; die genaue Firmierung als GmbH & Co. KG wird anschließend geprüft" : ""}.`,
      );
    } catch (error) {
      setMessageTone("error");
      setMessage(
        error instanceof Error ? error.message : "Vorschau fehlgeschlagen",
      );
    } finally {
      setBusy(false);
      setActiveAction(null);
    }
  }

  async function saveSearch({
    runNow,
    activateSchedule,
  }: {
    runNow: boolean;
    activateSchedule: boolean;
  }) {
    const form = formRef.current;
    if (!form?.reportValidity()) return;
    setBusy(true);
    setActiveAction(runNow ? "run" : activateSchedule ? "schedule" : "save");
    setMessageTone("info");
    setMessage(
      runNow
        ? "OpenRegister-Suche wird ausgeführt…"
        : activateSchedule
          ? "Der tägliche Zeitplan wird aktiviert…"
          : "Suche wird gespeichert…",
    );
    try {
      const response = await fetch("/api/searches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId,
        },
        body: JSON.stringify(requestBody(runNow, activateSchedule)),
      });
      const result = (await response.json()) as SearchApiResponse;
      if (!response.ok)
        throw new Error(
          result.error ?? "Suche konnte nicht gespeichert werden.",
        );
      setMessage(
        result.run
          ? `Lauf abgeschlossen: ${result.run.accepted} neu, ${result.run.duplicates} bereits vorhanden; ${result.run.websitesAdded} Websites automatisch ergänzt; ${result.run.enrichmentCalls + result.run.websiteDiscoveryCalls} Anreicherungsaufrufe erfasst (${result.run.creditsUsed} Credits).`
          : activateSchedule
            ? "Täglicher Zeitplan aktiviert."
            : "Suche als Entwurf gespeichert.",
      );
      setMessageTone("success");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessageTone("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Suche konnte nicht eingerichtet werden.",
      );
    } finally {
      setBusy(false);
      setActiveAction(null);
    }
  }
  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <button
        type="button"
        onClick={openBuilder}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#15352e] px-4 text-sm font-medium text-white"
      >
        <Plus size={15} /> {triggerLabel}
      </button>
      {message && !open && (
        <p className="max-w-sm text-xs leading-5 text-[#4f655e]">{message}</p>
      )}
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#101b18]/45"
          role="dialog"
          aria-modal="true"
          aria-label="Gespeicherte Suche erstellen"
        >
          <form
            ref={formRef}
            onSubmit={(event) => event.preventDefault()}
            className="h-full w-full max-w-[720px] overflow-y-auto bg-[#f8f6f0] shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#d9d6ce] bg-[#f8f6f0]/95 px-6 py-5 backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#13745f]">
                  Suchkonfiguration
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  Neue Akquisitionssuche
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-[#d6d3cb] bg-white px-3 py-2 text-xs"
              >
                Schließen
              </button>
            </div>
            <div className="space-y-6 p-6">
              <Section title="Suchangaben">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name der Suche">
                    <input
                      name="name"
                      placeholder="z. B. Maschinenbau in Bayern"
                      required
                    />
                  </Field>
                  <Field label="Beschreibung">
                    <input name="description" placeholder="Optional" />
                  </Field>
                </div>
              </Section>
              <Section title="Unternehmensprofil">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Unternehmensstatus">
                    <select
                      name="status"
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value as typeof status)
                      }
                    >
                      <option value="all">
                        Aktive und inaktive Unternehmen
                      </option>
                      <option value="active">Nur aktive Unternehmen</option>
                    </select>
                  </Field>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.1em] text-[#6b7671]">
                      Rechtsformen
                    </p>
                    <LegalFormSelector
                      selected={selectedLegalForms}
                      onSelectedChange={setSelectedLegalForms}
                    />
                    <p className="mt-2 text-xs leading-5 text-[#7a8580]">
                      OpenRegister führt GmbH &amp; Co. KG unter der Rechtsform
                      KG. Die genaue Firmierung wird nach der Suche geprüft.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.1em] text-[#6b7671]">
                      WZ-2025-Branchen
                    </p>
                    <IndustrySelector
                      query={industryQuery}
                      onQueryChange={setIndustryQuery}
                      selected={selectedIndustries}
                      onSelectedChange={setSelectedIndustries}
                    />
                    <p className="mt-2 text-xs leading-5 text-[#7a8580]">
                      Branchen können nach Namen oder WZ-2025-Code gesucht
                      werden. Die ausgewählten Codes werden im Hintergrund
                      übermittelt.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.1em] text-[#6b7671]">
                      Standort
                    </p>
                    <StateSelector
                      selected={selectedStates}
                      onSelectedChange={setSelectedStates}
                    />
                    <p className="mt-2 text-xs leading-5 text-[#7a8580]">
                      Deutschland ist fest vorgegeben. Bundesländer werden über
                      die jeweils zuständigen Registergerichte zugeordnet.
                    </p>
                  </div>
                </div>
              </Section>
              <Section title="Größe & Finanzdaten">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Range field="employees" label="Beschäftigte" min="" max="" />
                  <Range
                    field="revenue"
                    label="Umsatz · EUR"
                    min=""
                    max=""
                    formattedNumber
                  />
                  <Range
                    field="ebitda"
                    label="EBITDA · EUR"
                    min=""
                    max=""
                    disabled={!requireReportedEbitda}
                    formattedNumber
                  />
                  <Range
                    field="incorporated_at"
                    label="Gründungsdatum"
                    min=""
                    max=""
                    type="date"
                  />
                </div>
                <label className="mt-4 flex items-start gap-3 rounded-lg border border-[#d9e4df] bg-white p-3 text-xs">
                  <input
                    type="checkbox"
                    checked={requireReportedEbitda}
                    onChange={(event) =>
                      setRequireReportedEbitda(event.target.checked)
                    }
                  />
                  <span>
                    <span className="block font-semibold">
                      Gemeldetes EBITDA als Filter verwenden
                    </span>
                    <span className="mt-1 block leading-5 text-[#6f7b76]">
                      Aktivieren Sie diese Option, um oben einen eigenen
                      EBITDA-Bereich festzulegen. Ohne Auswahl werden
                      Unternehmen unabhängig von gemeldeten EBITDA-Daten
                      berücksichtigt.
                    </span>
                  </span>
                </label>
                {advancedFinancials && (
                  <div className="mt-4 grid gap-4 rounded-xl border border-[#d9e4df] bg-[#f2f7f4] p-4 sm:grid-cols-2">
                    <Range
                      field="ebit"
                      label="EBIT · EUR"
                      min=""
                      max=""
                      formattedNumber
                    />
                    <Range
                      field="equity"
                      label="Eigenkapital · EUR"
                      min=""
                      max=""
                      formattedNumber
                    />
                    <Range
                      field="financial_debt"
                      label="Finanzverbindlichkeiten · EUR"
                      min=""
                      max=""
                      formattedNumber
                    />
                    <Range
                      field="balance_sheet_total"
                      label="Bilanzsumme · EUR"
                      min=""
                      max=""
                      formattedNumber
                    />
                    <p className="sm:col-span-2 text-xs leading-4 text-[#6f7b76]">
                      Verfügbare OpenRegister-Felder: EBIT, Eigenkapital,
                      Finanzverbindlichkeiten und Bilanzsumme. EUR-Beträge
                      werden vor der API-Abfrage in Cent umgerechnet.
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setAdvancedFinancials((value) => !value)}
                  aria-expanded={advancedFinancials}
                  className="mt-4 text-xs font-semibold text-[#13745f]"
                >
                  {advancedFinancials
                    ? "− Erweiterte Finanzdaten ausblenden"
                    : "+ Erweiterte Finanzdaten (EBIT, Eigenkapital, Schulden…)"}
                </button>
              </Section>
              <CollapsibleSection
                title="Eigentümerstruktur & Risiko"
                description="Optionale Eigentümer- und Risikofilter"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Inhabergeführt", "has_representative_owner", true],
                    ["Familiengeführt", "is_family_owned", true],
                    [
                      "Laufende Insolvenz ausschließen",
                      "has_open_insolvency",
                      false,
                    ],
                    ["Alleineigentümer", "has_sole_owner", true],
                  ].map(([label, field, enterprise]) => (
                    <label
                      key={String(label)}
                      className="flex items-center gap-3 rounded-lg border border-[#dfdcd4] bg-white p-3 text-xs"
                    >
                      <input
                        type="checkbox"
                        name="ownership_filter"
                        value={String(field)}
                      />
                      <span>
                        {label}
                        <span className="mt-0.5 block font-mono text-xs text-[#7a8580]">
                          {field}
                          {field === "has_open_insolvency"
                            ? " = false"
                            : " = true"}
                        </span>
                      </span>
                      {enterprise && (
                        <span className="ml-auto rounded bg-[#fff2c8] px-1.5 py-1 text-xs font-semibold text-[#6f581e]">
                          Enterprise-Tarif
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Mindestalter des jüngsten Eigentümers">
                    <input
                      name="youngest_owner_age_min"
                      type="number"
                      min={18}
                      max={100}
                      placeholder="Keine Einschränkung"
                    />
                  </Field>
                  <Field label="Unternehmensgegenstand · eines der Stichwörter">
                    <input
                      name="purpose_keywords"
                      placeholder="z. B. Maschinenbau, Instandhaltung"
                    />
                  </Field>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#7a8580]">
                  Eigentümeralter und Eigentümermerkmale bleiben optional, da
                  diese Suchfilter laut Dokumentation den Enterprise-Tarif
                  erfordern. Im Pro-Tarif können sie nach der
                  Eigentümeranreicherung abgeleitet werden.
                </p>
              </CollapsibleSection>
              <Section title="Datenumfang & Ausführung">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase tracking-[.1em] text-[#6b7671]">
                    Ausführungsart
                  </legend>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm transition-colors ${
                        executionMode === "once"
                          ? "border-[#78ad9e] bg-[#eaf5f1]"
                          : "border-[#d8d5cd] bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="execution_mode"
                        value="once"
                        checked={executionMode === "once"}
                        onChange={() => setExecutionMode("once")}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block font-semibold">
                          Einmaliger Lauf
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[#66736e]">
                          Jetzt einmal ausführen und danach nicht erneut
                          starten.
                        </span>
                      </span>
                    </label>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm transition-colors ${
                        executionMode === "recurring"
                          ? "border-[#78ad9e] bg-[#eaf5f1]"
                          : "border-[#d8d5cd] bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="execution_mode"
                        value="recurring"
                        checked={executionMode === "recurring"}
                        onChange={() => setExecutionMode("recurring")}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block font-semibold">
                          Täglich wiederholen
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[#66736e]">
                          Jeden Tag zur gewählten Zeit mit demselben Limit
                          ausführen.
                        </span>
                      </span>
                    </label>
                  </div>
                </fieldset>
                <div className="mt-4 rounded-xl border border-[#b8d8ce] bg-[#eaf5f1] p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <label
                        htmlFor="company-result-limit"
                        className="text-xs font-semibold uppercase tracking-[.1em] text-[#24735f]"
                      >
                        Unternehmen pro Lauf
                      </label>
                      <p
                        id="company-result-limit-help"
                        className="mt-1 max-w-md text-xs leading-5 text-[#587068]"
                      >
                        Legt fest, wie viele passende Unternehmen höchstens
                        gespeichert und angereichert werden.
                      </p>
                    </div>
                    <input
                      id="company-result-limit"
                      aria-describedby="company-result-limit-help"
                      type="number"
                      min={1}
                      max={100}
                      value={dailyTarget}
                      onChange={(event) =>
                        setDailyTarget(
                          Math.max(
                            1,
                            Math.min(100, Number(event.target.value)),
                          ),
                        )
                      }
                      className="h-11 w-full rounded-lg border border-[#9fc8bb] bg-white px-3 text-lg font-semibold tabular-nums sm:w-28"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[10, 25, 50, 100].map((limit) => (
                      <button
                        key={limit}
                        type="button"
                        onClick={() => setDailyTarget(limit)}
                        aria-pressed={dailyTarget === limit}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          dailyTarget === limit
                            ? "border-[#24735f] bg-[#24735f] text-white"
                            : "border-[#b8d8ce] bg-white text-[#42645b]"
                        }`}
                      >
                        {limit} Unternehmen
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Datenumfang">
                    <select
                      value={mode}
                      onChange={(event) =>
                        setMode(event.target.value as typeof mode)
                      }
                    >
                      <option value="lean">Kompakt · nur Stammdaten</option>
                      <option value="full">
                        Vollständig · Stammdaten, Finanzdaten, Eigentümer
                      </option>
                    </select>
                  </Field>
                  {executionMode === "recurring" ? (
                    <>
                      <Field label="Tägliche Ausführungszeit">
                        <input
                          name="schedule_time"
                          type="time"
                          defaultValue="06:30"
                        />
                      </Field>
                      <Field label="Zeitzone">
                        <input value="Europe/Berlin" readOnly />
                      </Field>
                    </>
                  ) : null}
                </div>
              </Section>
              <div className="rounded-xl border border-[#b8d8ce] bg-[#eaf5f1] p-4">
                <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#24735f]">
                  Zusammenfassung
                </p>
                <p className="mt-2 text-sm leading-6">
                  {currentSelectionSummary} Pro Lauf werden höchstens{" "}
                  {dailyTarget} passende Unternehmen verarbeitet.{" "}
                  {executionMode === "once"
                    ? "Die Suche wird einmalig ausgeführt."
                    : "Die Suche wird täglich wiederholt."}
                </p>
              </div>
              <div className="rounded-xl bg-[#172521] p-5 text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold">
                      Geschätzte Anbieternutzung
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      Konfigurierte Tarife; tatsächliche Nutzung wird je Auftrag
                      erfasst.
                    </p>
                  </div>
                  <Calculator size={18} className="text-[#54d5b3]" />
                </div>
                <div
                  className={`mt-5 grid gap-4 ${
                    executionMode === "recurring" ? "grid-cols-2" : ""
                  }`}
                >
                  <div>
                    <p className="text-xs text-white/45">
                      Maximal pro Lauf · {dailyTarget} Unternehmen
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {dailyCost.toLocaleString("de-DE")} Credits
                    </p>
                  </div>
                  {executionMode === "recurring" ? (
                    <div>
                      <p className="text-xs text-white/45">
                        Monatliche Schätzung · 30 Tage
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums">
                        {(dailyCost * 30).toLocaleString("de-DE")} Credits
                      </p>
                    </div>
                  ) : null}
                </div>
                <div
                  id="result-count-preview-help"
                  className="mt-5 border-t border-white/10 pt-4"
                >
                  <p className="text-xs font-semibold text-white/80">
                    Was macht „Treffermenge ermitteln“?
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/50">
                    Die aktuellen Filter werden einmal an OpenRegister gesendet,
                    um nur die Zahl der passenden Unternehmen anzuzeigen. Es
                    werden keine Unternehmen gespeichert oder angereichert. Die
                    Abfrage kostet {providerCosts.previewSearch} Credits.
                  </p>
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 flex flex-wrap justify-between gap-3 border-t border-[#d9d6ce] bg-[#f8f6f0]/95 px-6 py-4 backdrop-blur">
              {message ? (
                <p
                  role={messageTone === "error" ? "alert" : "status"}
                  aria-live="polite"
                  className={`w-full rounded-lg border px-4 py-3 text-sm font-medium leading-5 ${
                    messageTone === "error"
                      ? "border-[#e3b9b2] bg-[#f8e9e6] text-[#8b3e35]"
                      : messageTone === "success"
                        ? "border-[#b5d9cd] bg-[#e8f4ef] text-[#286b59]"
                        : "border-[#cfd8d4] bg-[#edf4f1] text-[#42645b]"
                  }`}
                >
                  {message}
                </p>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={previewCount}
                aria-describedby="result-count-preview-help"
                className="flex h-10 items-center gap-2 rounded-lg border border-[#d6d3cb] bg-white px-4 text-xs font-semibold disabled:opacity-50"
              >
                {activeAction === "preview" ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
                {activeAction === "preview"
                  ? "Live-Trefferzahl wird geprüft…"
                  : "Treffermenge ermitteln · 10 Credits"}
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    saveSearch({ runNow: false, activateSchedule: false })
                  }
                  className="flex h-10 items-center gap-2 rounded-lg border border-[#d6d3cb] bg-white px-4 text-xs font-semibold disabled:opacity-50"
                >
                  {activeAction === "save" ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}{" "}
                  Entwurf speichern
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    saveSearch({
                      runNow: executionMode === "once",
                      activateSchedule: executionMode === "recurring",
                    })
                  }
                  className="flex h-10 items-center gap-2 rounded-lg bg-[#15352e] px-4 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {activeAction === "run" || activeAction === "schedule" ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : executionMode === "once" ? (
                    <Play size={14} />
                  ) : (
                    <CalendarClock size={14} />
                  )}{" "}
                  {executionMode === "once"
                    ? "Einmalig ausführen"
                    : "Täglichen Zeitplan aktivieren"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function IndustrySelector({
  query,
  onQueryChange,
  selected,
  onSelectedChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  selected: string[];
  onSelectedChange: (value: string[]) => void;
}) {
  const filteredIndustries = useMemo(
    () => filterWz2025Industries(query),
    [query],
  );
  const selectedSet = new Set(selected);
  return (
    <details className="group relative mt-2">
      <summary className="flex min-h-10 w-full cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-[#d8d5cd] bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal outline-none marker:hidden focus-visible:border-[#2a8f74] focus-visible:ring-3 focus-visible:ring-[#2a8f74]/12 [&::-webkit-details-marker]:hidden">
        <span
          className={`min-w-0 flex-1 ${selected.length ? "text-[#27332f]" : "text-[#7a8580]"}`}
        >
          {selected.length
            ? `${selected.length} ${selected.length === 1 ? "Branche" : "Branchen"} ausgewählt`
            : "Branchen nach Name oder Code auswählen"}
        </span>
        <ChevronDown
          size={16}
          className="shrink-0 transition group-open:rotate-180"
        />
      </summary>
      <div className="absolute z-20 mt-2 w-full min-w-[320px] rounded-xl border border-[#d7d4cc] bg-white p-3 shadow-xl">
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Suchen, z. B. 43.22, Elektronik …"
          aria-label="Branchen nach Namen oder WZ-Code durchsuchen"
          className="form-control"
        />
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-[#ebe8e1]">
          {filteredIndustries.length ? (
            filteredIndustries.map((industry) => {
              const checked = selectedSet.has(industry.code);
              return (
                <label
                  key={industry.code}
                  className="flex cursor-pointer items-start gap-2 border-b border-[#efede7] px-3 py-2.5 text-sm font-normal normal-case leading-5 tracking-normal last:border-0 hover:bg-[#f4f7f5]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      onSelectedChange(
                        checked
                          ? selected.filter((code) => code !== industry.code)
                          : [...selected, industry.code],
                      )
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="mr-2 font-mono text-xs font-semibold text-[#52605a]">
                      {industry.code}
                    </span>
                    {industry.name}
                  </span>
                </label>
              );
            })
          ) : (
            <p className="p-4 text-sm text-[#7a8580]">
              Keine Branche entspricht dieser Suche.
            </p>
          )}
        </div>
        {selected.length ? (
          <button
            type="button"
            onClick={() => onSelectedChange([])}
            className="mt-2 text-xs font-semibold text-[#087b62]"
          >
            Auswahl löschen
          </button>
        ) : null}
      </div>
    </details>
  );
}

function StateSelector({
  selected,
  onSelectedChange,
}: {
  selected: string[];
  onSelectedChange: (value: string[]) => void;
}) {
  const selectedSet = new Set(selected);
  return (
    <details className="group relative mt-2">
      <summary className="flex min-h-10 w-full cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-[#d8d5cd] bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal outline-none marker:hidden focus-visible:border-[#2a8f74] focus-visible:ring-3 focus-visible:ring-[#2a8f74]/12 [&::-webkit-details-marker]:hidden">
        <span
          className={`min-w-0 flex-1 ${selected.length ? "text-[#27332f]" : "text-[#7a8580]"}`}
        >
          {selected.length ? selected.join(", ") : "Alle Bundesländer"}
        </span>
        <ChevronDown
          size={16}
          className="shrink-0 transition group-open:rotate-180"
        />
      </summary>
      <div className="absolute right-0 z-20 mt-2 max-h-72 w-full min-w-[320px] overflow-y-auto rounded-xl border border-[#d7d4cc] bg-white p-2 shadow-xl">
        {germanStates.map((state) => {
          const checked = selectedSet.has(state.name);
          return (
            <label
              key={state.name}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-normal normal-case tracking-normal hover:bg-[#f4f7f5]"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onSelectedChange(
                    checked
                      ? selected.filter((name) => name !== state.name)
                      : [...selected, state.name],
                  )
                }
              />
              <span className="flex-1">{state.name}</span>
              {checked ? <Check size={14} className="text-[#13745f]" /> : null}
            </label>
          );
        })}
      </div>
    </details>
  );
}

function LegalFormSelector({
  selected,
  onSelectedChange,
}: {
  selected: string[];
  onSelectedChange: (value: string[]) => void;
}) {
  const options = [
    { value: "gmbh", label: "GmbH" },
    { value: "kg", label: "GmbH-&-Co.-KG-Kandidaten" },
  ];
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const checked = selected.includes(option.value);
        return (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#dfdcd4] bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => {
                onSelectedChange(
                  checked
                    ? selected.filter((value) => value !== option.value)
                    : [...selected, option.value],
                );
              }}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function CollapsibleSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-[#d8d5cd] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-4 py-3.5 outline-none focus-visible:ring-3 focus-visible:ring-[#2a8f74]/12 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-0.5 block text-xs leading-5 text-[#73807b]">
            {description}
          </span>
        </span>
        <ChevronDown
          size={17}
          className="shrink-0 text-[#64726d] transition group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-[#e5e2db] p-4">{children}</div>
    </details>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[.1em] text-[#6b7671]">
      {label}
      <span className="mt-2 block [&_input]:form-control [&_select]:form-control">
        {children}
      </span>
    </label>
  );
}
function Range({
  field,
  label,
  min,
  max,
  type = "number",
  disabled = false,
  formattedNumber = false,
}: {
  field: string;
  label: string;
  min: string;
  max: string;
  type?: string;
  disabled?: boolean;
  formattedNumber?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[.1em] text-[#6b7671]">
        {label}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {formattedNumber ? (
          <>
            <FormattedNumberInput
              name={`${field}_min`}
              ariaLabel={`${label} Minimum`}
              defaultValue={min}
              disabled={disabled}
              placeholder="Minimum"
            />
            <FormattedNumberInput
              name={`${field}_max`}
              ariaLabel={`${label} Maximum`}
              defaultValue={max}
              disabled={disabled}
              placeholder="Maximum"
            />
          </>
        ) : (
          <>
            <input
              name={`${field}_min`}
              className="form-control"
              aria-label={`${label} Minimum`}
              type={type}
              defaultValue={min}
              disabled={disabled}
              placeholder="Minimum"
            />
            <input
              name={`${field}_max`}
              className="form-control"
              aria-label={`${label} Maximum`}
              type={type}
              defaultValue={max}
              disabled={disabled}
              placeholder="Maximum"
            />
          </>
        )}
      </div>
    </div>
  );
}

function FormattedNumberInput({
  name,
  ariaLabel,
  defaultValue,
  disabled,
  placeholder,
}: {
  name: string;
  ariaLabel: string;
  defaultValue: string;
  disabled: boolean;
  placeholder: string;
}) {
  const [value, setValue] = useState(() =>
    defaultValue ? formatLocalizedNumber(defaultValue) : "",
  );

  function validate(input: HTMLInputElement) {
    input.setCustomValidity(
      !input.value || Number.isFinite(parseLocalizedNumber(input.value))
        ? ""
        : "Bitte geben Sie eine gültige Zahl ein.",
    );
  }

  return (
    <input
      name={name}
      className="form-control tabular-nums"
      aria-label={ariaLabel}
      type="text"
      inputMode="decimal"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => {
        setValue(event.target.value);
        validate(event.currentTarget);
      }}
      onBlur={(event) => {
        validate(event.currentTarget);
        if (Number.isFinite(parseLocalizedNumber(event.currentTarget.value)))
          setValue(formatLocalizedNumber(event.currentTarget.value));
      }}
    />
  );
}

export function SearchCard({
  name,
  summary,
  active,
  lastRun,
  accepted,
}: {
  name: string;
  summary: string;
  active: boolean;
  lastRun: string;
  accepted: number;
}) {
  const [isActive, setIsActive] = useState(active);
  return (
    <article className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{name}</h2>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${isActive ? "bg-[#e0f2ec] text-[#236a58]" : "bg-[#eceae5] text-[#717a76]"}`}
            >
              {isActive ? "Aktiv" : "Pausiert"}
            </span>
          </div>
          <p className="mt-3 max-w-xl text-xs leading-5 text-[#68736e]">
            {summary}
          </p>
        </div>
        <button
          onClick={() => setIsActive((value) => !value)}
          aria-label={isActive ? "Zeitplan pausieren" : "Zeitplan fortsetzen"}
          className="grid size-9 place-items-center rounded-lg border border-[#d7d4cc] bg-white"
        >
          {isActive ? <CirclePause size={15} /> : <Play size={15} />}
        </button>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-4 border-t border-[#e3e0d8] pt-4 text-xs">
        <div>
          <p className="text-[#84908b]">Letzter Lauf</p>
          <p className="mt-1 font-semibold">{lastRun}</p>
        </div>
        <div>
          <p className="text-[#84908b]">Neu übernommen</p>
          <p className="mt-1 font-semibold tabular-nums">{accepted}</p>
        </div>
        <div>
          <p className="text-[#84908b]">Modus</p>
          <p className="mt-1 font-semibold">Kompakt · 420 Credits/Tag</p>
        </div>
      </div>
      <button className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#087b62]">
        <Play size={12} /> Jetzt ausführen
      </button>
    </article>
  );
}
