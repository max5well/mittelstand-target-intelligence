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
  "Workspace",
  "Members & roles",
  "MFA & security",
  "Provider costs",
  "Scoring model",
  "Data retention",
  "Integrations",
] as const;
type SectionName = (typeof sections)[number];

export function SettingsPanel({ integrations, initialSection = "Workspace" }: { integrations: IntegrationStatus[]; initialSection?: SectionName }) {
  const [active, setActive] = useState<SectionName>(initialSection);
  const [notice, setNotice] = useState("");

  function selectSection(section: SectionName) {
    setActive(section);
    setNotice("");
    window.history.replaceState(null, "", section === "Integrations" ? "?section=integrations" : window.location.pathname);
  }

  return (
    <div className="mt-8 grid gap-7 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Settings sections" className="space-y-1 text-sm">
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
        {notice && <p role="status" className="mb-4 rounded-lg border border-[#b8d8ce] bg-[#eaf5f1] px-4 py-3 text-sm text-[#225f50]">{notice}</p>}

        {active === "Workspace" && (
          <SettingsCard icon={ShieldCheck} title="Private workspace">
            <p className="text-sm leading-6 text-[#68736e]">No public sign-up is exposed. Membership is granted by an administrator.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[["Workspace name", "DACH Industrials I"], ["Data region", "EU"], ["Default timezone", "Europe/Berlin"], ["Default currency", "EUR · integer cents"]].map(([label, value]) => (
                <label key={label} className="text-xs font-semibold uppercase tracking-[.08em] text-[#6b7671]">
                  {label}<input className="form-control mt-2" defaultValue={value} />
                </label>
              ))}
            </div>
            <SaveButton onClick={() => setNotice("Saved for this session. Persistent saving will be enabled with the production database.")} />
          </SettingsCard>
        )}

        {active === "Members & roles" && <SettingsCard icon={UserPlus} title="Members & roles"><Body>Membership is currently enforced by the private site allowlist. Database-backed roles will appear here after Supabase is connected.</Body></SettingsCard>}
        {active === "MFA & security" && <SettingsCard icon={ShieldCheck} title="MFA & security"><Body>The deployment is owner-only. Application MFA and workspace invitations require the production authentication database.</Body></SettingsCard>}

        {active === "Provider costs" && (
          <SettingsCard icon={KeyRound} title="Provider costs">
            <Body>OpenRegister documents per-request credit costs. Its remaining balance is not exposed by the API, so the provider dashboard remains the source of truth.</Body>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[["Advanced search", "10"], ["Company details", "10"], ["Financials", "10"], ["Owners", "10"]].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[#dedbd3] bg-white p-3">
                  <p className="text-xs text-[#6b7671]">{label}</p><p className="mt-2 text-base font-semibold tabular-nums">{value} credits</p>
                </div>
              ))}
            </div>
          </SettingsCard>
        )}

        {active === "Scoring model" && <SettingsCard icon={CheckCircle2} title="Scoring model"><Body>No active model is configured. Scores remain hidden until real company data and a versioned scoring configuration are stored.</Body></SettingsCard>}
        {active === "Data retention" && <SettingsCard icon={ShieldCheck} title="Data retention"><Body>Retention controls require the production database. No retention policy is currently being represented as active.</Body></SettingsCard>}

        {active === "Integrations" && (
          <section className="space-y-4" id="integrations">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
              <div><h2 className="text-base font-semibold">Data-source status</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#68736e]">Ready requires a server-side API key, live-provider mode, and a persistent database destination. A key alone is not reported as a working connection.</p></div>
              <button type="button" onClick={() => window.location.reload()} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-[#d6d3cb] bg-white px-3 text-sm font-semibold"><RefreshCw size={14} /> Refresh</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {integrations.map((integration) => (
                <article key={integration.id} className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="text-base font-semibold">{integration.name}</h3><p className="mt-1 text-sm leading-6 text-[#68736e]">{integration.purpose}</p></div>
                    <StatusBadge integration={integration} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">{integration.capabilities.map((capability) => <span key={capability} className="rounded bg-[#eceae5] px-2 py-1 text-xs font-medium text-[#5f6965]">{capability}</span>)}</div>
                  <dl className="mt-5 grid gap-2.5 text-xs text-[#69736f]">
                    <StatusRow label="API credential" value={integration.configured ? "Configured" : "Missing"} />
                    <StatusRow label="Persistent destination" value={integration.destinationConfigured ? "Configured" : "Missing"} />
                    <StatusRow label="Live provider mode" value={integration.liveMode ? "Enabled" : "Disabled"} />
                  </dl>
                  <a href={integration.dashboardUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#087b62]">Open provider dashboard <ExternalLink size={11} /></a>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SettingsCard({ icon: Icon, title, children }: { icon: typeof ShieldCheck; title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-6"><div className="mb-4 flex items-center gap-2"><Icon size={18} className="text-[#16856b]" /><h2 className="text-base font-semibold">{title}</h2></div>{children}</section>;
}
function Body({ children }: { children: React.ReactNode }) { return <p className="max-w-2xl text-sm leading-6 text-[#68736e]">{children}</p>; }
function SaveButton({ onClick }: { onClick: () => void }) { return <button type="button" onClick={onClick} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#087b62]"><CheckCircle2 size={14} /> Save changes</button>; }
function StatusRow({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><dt>{label}</dt><dd className="font-semibold text-[#26322e]">{value}</dd></div>; }
function StatusBadge({ integration }: { integration: IntegrationStatus }) {
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${integration.usable ? "bg-[#e4f1ed] text-[#27705d]" : "bg-[#fff0df] text-[#8b5b22]"}`}>{integration.usable ? <CheckCircle2 size={11} /> : <CircleAlert size={11} />}{integration.usable ? "Ready" : "Not ready"}</span>;
}
