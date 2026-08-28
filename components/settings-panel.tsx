"use client";

import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import type { IntegrationStatus } from "@/lib/integrations/status";

const sections = [
  "Arbeitsbereich",
  "Mitglieder & Rollen",
  "MFA & Sicherheit",
  "Anbieterkosten",
  "Scoring-Modell",
  "Datenaufbewahrung",
  "Integrationen",
] as const;
type SectionName = (typeof sections)[number];

export function SettingsPanel({
  integrations,
  initialSection = "Arbeitsbereich",
}: {
  integrations: IntegrationStatus[];
  initialSection?: SectionName;
}) {
  const [active, setActive] = useState<SectionName>(initialSection);
  const [notice, setNotice] = useState("");

  function selectSection(section: SectionName) {
    setActive(section);
    setNotice("");
    window.history.replaceState(
      null,
      "",
      section === "Integrationen"
        ? "?section=integrations"
        : window.location.pathname,
    );
  }

  return (
    <div className="mt-8 grid gap-7 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Einstellungsbereiche" className="space-y-1 text-sm">
        {sections.map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => selectSection(section)}
            aria-current={active === section ? "page" : undefined}
            className={`w-full rounded-lg px-3 py-3 text-left transition ${active === section ? "bg-[#dfeae5] font-semibold text-[#265e50]" : "text-[#65706c] hover:bg-white/70 hover:text-[#25332f]"}`}
          >
            {section}
          </button>
        ))}
      </nav>

      <div>
        {notice && (
          <p
            role="status"
            className="mb-4 rounded-lg border border-[#b8d8ce] bg-[#eaf5f1] px-4 py-3 text-sm text-[#225f50]"
          >
            {notice}
          </p>
        )}

        {active === "Arbeitsbereich" && (
          <SettingsCard icon={ShieldCheck} title="Privater Arbeitsbereich">
            <p className="text-sm leading-6 text-[#68736e]">
              Es gibt keine öffentliche Registrierung. Mitgliedschaften werden
              von einem Administrator vergeben.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ["Name des Arbeitsbereichs", "DACH Industrials I"],
                ["Datenregion", "EU"],
                ["Standard-Zeitzone", "Europe/Berlin"],
                ["Standardwährung", "EUR · ganze Cent"],
              ].map(([label, value]) => (
                <label
                  key={label}
                  className="text-xs font-semibold uppercase tracking-[.08em] text-[#6b7671]"
                >
                  {label}
                  <input className="form-control mt-2" defaultValue={value} />
                </label>
              ))}
            </div>
            <SaveButton
              onClick={() =>
                setNotice(
                  "Für diese Sitzung gespeichert. Dauerhaftes Speichern wird mit der Produktionsdatenbank aktiviert.",
                )
              }
            />
          </SettingsCard>
        )}

        {active === "Mitglieder & Rollen" && (
          <SettingsCard icon={UserPlus} title="Mitglieder & Rollen">
            <Body>
              Der Zugriff wird derzeit über die Freigabeliste der privaten
              Website gesteuert. Datenbankgestützte Rollen erscheinen hier nach
              der Supabase-Anbindung.
            </Body>
          </SettingsCard>
        )}
        {active === "MFA & Sicherheit" && (
          <SettingsCard icon={ShieldCheck} title="MFA & Sicherheit">
            <Body>
              Die Bereitstellung ist nur für den Eigentümer freigegeben. MFA und
              Einladungen erfordern die produktive Authentifizierungsdatenbank.
            </Body>
          </SettingsCard>
        )}

        {active === "Anbieterkosten" && (
          <SettingsCard icon={KeyRound} title="Anbieterkosten">
            <Body>
              OpenRegister dokumentiert die Credits pro Anfrage. Das
              Restguthaben wird nicht über die API bereitgestellt; maßgeblich
              bleibt daher das Anbieter-Dashboard.
            </Body>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Erweiterte Suche", "10"],
                ["Unternehmensdetails", "10"],
                ["Finanzdaten", "10"],
                ["Eigentümer", "10"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-[#dedbd3] bg-white p-3"
                >
                  <p className="text-xs text-[#6b7671]">{label}</p>
                  <p className="mt-2 text-base font-semibold tabular-nums">
                    {value} Credits
                  </p>
                </div>
              ))}
            </div>
          </SettingsCard>
        )}

        {active === "Scoring-Modell" && (
          <SettingsCard icon={CheckCircle2} title="Scoring-Modell">
            <Body>
              Es ist kein aktives Modell eingerichtet. Scores bleiben
              ausgeblendet, bis reale Unternehmensdaten und eine versionierte
              Scoring-Konfiguration gespeichert sind.
            </Body>
          </SettingsCard>
        )}
        {active === "Datenaufbewahrung" && (
          <SettingsCard icon={ShieldCheck} title="Datenaufbewahrung">
            <Body>
              Aufbewahrungsregeln erfordern die Produktionsdatenbank. Derzeit
              wird keine Richtlinie als aktiv dargestellt.
            </Body>
          </SettingsCard>
        )}

        {active === "Integrationen" && (
          <section className="space-y-4" id="integrations">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
              <div>
                <h2 className="text-base font-semibold">
                  Status der Datenquellen
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68736e]">
                  „Bereit“ erfordert einen serverseitigen API-Schlüssel, den
                  Live-Anbietermodus und ein dauerhaftes Datenbankziel. Ein
                  Schlüssel allein gilt nicht als funktionierende Verbindung.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-[#d6d3cb] bg-white px-3 text-sm font-semibold"
              >
                <RefreshCw size={14} /> Aktualisieren
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {integrations.map((integration) => (
                <article
                  key={integration.id}
                  className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">
                        {integration.name}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-[#68736e]">
                        {integration.purpose}
                      </p>
                    </div>
                    <StatusBadge integration={integration} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {integration.capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="rounded bg-[#eceae5] px-2 py-1 text-xs font-medium text-[#5f6965]"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                  <dl className="mt-5 grid gap-2.5 text-xs text-[#69736f]">
                    <StatusRow
                      label="API-Zugangsdaten"
                      value={integration.configured ? "Konfiguriert" : "Fehlt"}
                    />
                    <StatusRow
                      label="Dauerhaftes Datenziel"
                      value={
                        integration.destinationConfigured
                          ? "Konfiguriert"
                          : "Fehlt"
                      }
                    />
                    <StatusRow
                      label="Live-Anbietermodus"
                      value={integration.liveMode ? "Aktiviert" : "Deaktiviert"}
                    />
                  </dl>
                  <a
                    href={integration.dashboardUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#087b62]"
                  >
                    Anbieter-Dashboard öffnen <ExternalLink size={11} />
                  </a>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-6">
      <div className="mb-4 flex items-center gap-2">
        <Icon size={18} className="text-[#13745f]" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-2xl text-sm leading-6 text-[#68736e]">{children}</p>
  );
}
function SaveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#087b62]"
    >
      <CheckCircle2 size={14} /> Änderungen speichern
    </button>
  );
}
function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="font-semibold text-[#26322e]">{value}</dd>
    </div>
  );
}
function StatusBadge({ integration }: { integration: IntegrationStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${integration.usable ? "bg-[#e4f1ed] text-[#27705d]" : "bg-[#fff0df] text-[#8b5b22]"}`}
    >
      {integration.usable ? (
        <CheckCircle2 size={11} />
      ) : (
        <CircleAlert size={11} />
      )}
      {integration.usable ? "Bereit" : "Nicht bereit"}
    </span>
  );
}
