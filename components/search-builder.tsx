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
import {
  acquisitionTargetPreset,
  describeAcquisitionPreset,
} from "@/lib/acquisition-target-preset";
import { germanStates, registerCourtsForStates } from "@/lib/german-states";
import { wz2025Industries } from "@/lib/wz2025";

const providerCosts = { search: 10, details: 10, financials: 10, owners: 10 };

type SearchApiResponse = {
  error?: string;
  pagination?: { total_results?: number; total?: number };
  run?: {
    accepted: number;
    duplicates: number;
    enrichmentCalls: number;
    unavailable: number;
    enrichmentErrors: number;
    creditsUsed: number;
  } | null;
};

export function SearchBuilder({
  triggerLabel = "Neue gespeicherte Suche",
}: {
  triggerLabel?: string;
} = {}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState<
    "preview" | "save" | "run" | null
  >(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">(
    "info",
  );
  const [dailyTarget, setDailyTarget] = useState(10);
  const [mode, setMode] = useState<"lean" | "full">("full");
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([
    ...acquisitionTargetPreset.industryCodes,
  ]);
  const [industryQuery, setIndustryQuery] = useState("");
  const [selectedStates, setSelectedStates] = useState<string[]>([
    ...acquisitionTargetPreset.states,
  ]);
  const [selectedLegalForms, setSelectedLegalForms] = useState<string[]>([
    ...acquisitionTargetPreset.legalForms,
  ]);
  const [requireReportedEbitda, setRequireReportedEbitda] = useState(false);
  const [advancedFinancials, setAdvancedFinancials] = useState(false);
  const dailyCost = useMemo(
    () =>
      providerCosts.search +
      dailyTarget *
        (providerCosts.details +
          (mode === "full"
            ? providerCosts.financials + providerCosts.owners
            : 0)),
    [dailyTarget, mode],
  );

  function requestBody(runNow: boolean) {
    const form = formRef.current;
    if (!form) throw new Error("Das Suchformular ist nicht verfügbar.");
    const data = new FormData(form);
    const filters: Array<{
      field: string;
      value?: string;
      min?: string;
      max?: string;
      values?: string[];
      keywords?: string[];
    }> = [];
    filters.push({ field: "legal_form", values: selectedLegalForms });
    const status = String(data.get("status") ?? "active");
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
        if (conversion === "money" && value)
          return String(Math.round(Number(value) * 100));
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
    const industryNames = selectedIndustries
      .map(
        (code) =>
          wz2025Industries.find((industry) => industry.code === code)?.name,
      )
      .filter((name): name is string => Boolean(name));
    const excludesOpenInsolvency = filters.some(
      (filter) =>
        filter.field === "has_open_insolvency" && filter.value === "false",
    );
    return {
      name: String(data.get("name") ?? "").trim(),
      description: String(data.get("description") ?? "").trim(),
      summary: describeAcquisitionPreset({
        industryNames,
        states: selectedStates,
        legalForms: selectedLegalForms,
        requireReportedEbitda,
        excludeOpenInsolvency: excludesOpenInsolvency,
      }),
      filters,
      hydrationMode: mode,
      dailyTarget,
      scheduleTime: String(data.get("schedule_time") ?? "06:30"),
      active: data.get("active") === "on",
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
        headers: { "Content-Type": "application/json" },
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

  async function saveSearch(runNow: boolean) {
    const form = formRef.current;
    if (!form?.reportValidity()) return;
    setBusy(true);
    setActiveAction(runNow ? "run" : "save");
    setMessageTone("info");
    setMessage(
      runNow
        ? "OpenRegister-Suche wird ausgeführt…"
        : "Suche wird gespeichert…",
    );
    try {
      const response = await fetch("/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody(runNow)),
      });
      const result = (await response.json()) as SearchApiResponse;
      if (!response.ok)
        throw new Error(
          result.error ?? "Suche konnte nicht gespeichert werden.",
        );
      setMessage(
        result.run
          ? `Lauf abgeschlossen: ${result.run.accepted} neu, ${result.run.duplicates} bereits vorhanden; ${result.run.enrichmentCalls} Anreicherungsaufrufe erfasst (${result.run.creditsUsed} Credits).`
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
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#13201d] px-4 text-sm font-medium text-white"
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
            className="h-full w-full max-w-[720px] overflow-y-auto bg-[#f8f7f3] shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#d9d6ce] bg-[#f8f7f3]/95 px-6 py-5 backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#16856b]">
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
                      defaultValue={acquisitionTargetPreset.name}
                      required
                    />
                  </Field>
                  <Field label="Beschreibung">
                    <input
                      name="description"
                      defaultValue={acquisitionTargetPreset.description}
                    />
                  </Field>
                </div>
              </Section>
              <Section title="Unternehmensprofil">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Unternehmensstatus">
                    <select name="status" defaultValue="active">
                      <option value="active">Nur aktive Unternehmen</option>
                      <option value="all">
                        Aktive und inaktive Unternehmen
                      </option>
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
                      Branchen werden nach Namen ausgewählt. Die erforderlichen
                      WZ-2025-Codes werden im Hintergrund übermittelt.
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
                    min={acquisitionTargetPreset.revenueEur.min}
                    max={acquisitionTargetPreset.revenueEur.max}
                  />
                  <Range
                    field="ebitda"
                    label="EBITDA · EUR"
                    min={acquisitionTargetPreset.preferredEbitdaEur.min}
                    max={acquisitionTargetPreset.preferredEbitdaEur.max}
                    disabled={!requireReportedEbitda}
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
                      Gemeldetes EBITDA zwischen 2 Mio. € und 5 Mio. €
                      voraussetzen
                    </span>
                    <span className="mt-1 block leading-5 text-[#6f7b76]">
                      Standardmäßig deaktiviert. Der Umsatzbereich von 10–50
                      Mio. € unterstellt eine EBITDA-Marge von 10–20 % und
                      schließt Unternehmen ohne gemeldetes EBITDA nicht aus.
                    </span>
                  </span>
                </label>
                {advancedFinancials && (
                  <div className="mt-4 grid gap-4 rounded-xl border border-[#d9e4df] bg-[#f2f7f4] p-4 sm:grid-cols-2">
                    <Range field="ebit" label="EBIT · EUR" min="" max="" />
                    <Range
                      field="equity"
                      label="Eigenkapital · EUR"
                      min=""
                      max=""
                    />
                    <Range
                      field="financial_debt"
                      label="Finanzverbindlichkeiten · EUR"
                      min=""
                      max=""
                    />
                    <Range
                      field="balance_sheet_total"
                      label="Bilanzsumme · EUR"
                      min=""
                      max=""
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
                  className="mt-4 text-xs font-semibold text-[#16856b]"
                >
                  {advancedFinancials
                    ? "− Erweiterte Finanzdaten ausblenden"
                    : "+ Erweiterte Finanzdaten (EBIT, Eigenkapital, Schulden…)"}
                </button>
              </Section>
              <Section title="Eigentümerstruktur & Risiko">
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
                  ].map(([label, field, enterprise], index) => (
                    <label
                      key={String(label)}
                      className="flex items-center gap-3 rounded-lg border border-[#dfdcd4] bg-white p-3 text-xs"
                    >
                      <input
                        type="checkbox"
                        name="ownership_filter"
                        value={String(field)}
                        defaultChecked={index === 2}
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
                      placeholder={acquisitionTargetPreset.purposeKeywordSuggestions.join(
                        ", ",
                      )}
                    />
                  </Field>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#7a8580]">
                  Eigentümeralter und Eigentümermerkmale bleiben optional, da
                  diese Suchfilter laut Dokumentation den Enterprise-Tarif
                  erfordern. Im Pro-Tarif können sie nach der
                  Eigentümeranreicherung abgeleitet werden.
                </p>
              </Section>
              <Section title="Datenumfang & Zeitplan">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Tägliches Ziel">
                    <input
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
                    />
                  </Field>
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
                  <Field label="Ausführungszeit">
                    <input
                      name="schedule_time"
                      type="time"
                      defaultValue="06:30"
                    />
                  </Field>
                  <Field label="Zeitzone">
                    <input value="Europe/Berlin" readOnly />
                  </Field>
                </div>
                <label className="mt-4 flex items-center gap-3 rounded-lg border border-[#d9e4df] bg-white p-3 text-xs font-semibold">
                  <input name="active" type="checkbox" />
                  Täglichen Zeitplan nach dem Speichern aktivieren
                </label>
              </Section>
              <div className="rounded-xl border border-[#b8d8ce] bg-[#eaf5f1] p-4">
                <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#24735f]">
                  Zusammenfassung
                </p>
                <p className="mt-2 text-sm leading-6">
                  Klima- und Lüftungstechnik einschließlich Installation sowie
                  Dachdeckerei; Berlin, Brandenburg, Bayern, Nordrhein-Westfalen
                  und Baden-Württemberg; GmbH- und KG-Kandidaten; 10–50 Mio. €
                  Umsatz; laufende Insolvenzen ausgeschlossen. Ein EBITDA von
                  2–5 Mio. € ist eine Präferenz, sofern es oben nicht
                  ausdrücklich vorausgesetzt wird.
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
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-white/45">
                      Je geplanter Ausführung
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {dailyCost.toLocaleString("de-DE")} Credits
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/45">
                      Monatliche Schätzung · 30 Tage
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {(dailyCost * 30).toLocaleString("de-DE")} Credits
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-4 text-white/45">
                  Die Treffervorschau läuft nicht automatisch. Ein Klick darauf
                  verbraucht {providerCosts.search} Credits.
                </p>
              </div>
            </div>
            <div className="sticky bottom-0 flex flex-wrap justify-between gap-3 border-t border-[#d9d6ce] bg-[#f8f7f3]/95 px-6 py-4 backdrop-blur">
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
                className="flex h-10 items-center gap-2 rounded-lg border border-[#d6d3cb] bg-white px-4 text-xs font-semibold disabled:opacity-50"
              >
                {activeAction === "preview" ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
                {activeAction === "preview"
                  ? "Live-Trefferzahl wird geprüft…"
                  : "Trefferzahl prüfen · 10 Credits"}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveSearch(false)}
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
                  onClick={() => saveSearch(true)}
                  className="flex h-10 items-center gap-2 rounded-lg bg-[#13201d] px-4 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {activeAction === "run" ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <CalendarClock size={14} />
                  )}{" "}
                  Speichern & jetzt ausführen
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
  const filteredIndustries = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("de");
    if (!term) return wz2025Industries;
    return wz2025Industries.filter((industry) =>
      industry.name.toLocaleLowerCase("de").includes(term),
    );
  }, [query]);
  const selectedSet = new Set(selected);
  return (
    <details className="group relative mt-2">
      <summary className="form-control flex cursor-pointer list-none items-center justify-between text-sm font-normal normal-case tracking-normal marker:hidden">
        <span className={selected.length ? "text-[#27332f]" : "text-[#7a8580]"}>
          {selected.length
            ? `${selected.length} ${selected.length === 1 ? "Branche" : "Branchen"} ausgewählt`
            : "Branchen nach Namen auswählen"}
        </span>
        <ChevronDown size={16} className="transition group-open:rotate-180" />
      </summary>
      <div className="absolute z-20 mt-2 w-full min-w-[320px] rounded-xl border border-[#d7d4cc] bg-white p-3 shadow-xl">
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Suchen, z. B. Elektronik, Maschinenbau …"
          aria-label="Branchen nach Namen durchsuchen"
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
                  <span>{industry.name}</span>
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
      <summary className="form-control flex cursor-pointer list-none items-center justify-between text-sm font-normal normal-case tracking-normal marker:hidden">
        <span className={selected.length ? "text-[#27332f]" : "text-[#7a8580]"}>
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
              {checked ? <Check size={14} className="text-[#16856b]" /> : null}
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
                if (checked && selected.length === 1) return;
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
}: {
  field: string;
  label: string;
  min: string;
  max: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[.1em] text-[#6b7671]">
        {label}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
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
      </div>
    </div>
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
