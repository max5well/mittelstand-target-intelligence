import { CheckCircle2, KeyRound, ShieldCheck, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/app-shell";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[1200px] p-5 md:p-9">
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description="Control workspace access, provider costs, scoring, privacy, and retention."
      />
      <div className="mt-7 grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-1 text-xs">
          {[
            "Workspace",
            "Members & roles",
            "MFA & security",
            "Provider costs",
            "Scoring model",
            "Data retention",
          ].map((item, index) => (
            <button
              key={item}
              className={`w-full rounded-lg px-3 py-2.5 text-left ${index === 0 ? "bg-[#dfeae5] font-semibold text-[#265e50]" : "text-[#65706c]"}`}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="space-y-5">
          <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} className="text-[#16856b]" />
              <h2 className="text-sm font-semibold">Private workspace</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#68736e]">
              No public sign-up is exposed. Membership is granted by an
              administrator and enforced with workspace-aware RLS policies.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Workspace name", "DACH Industrials I"],
                ["Data region", "EU · configured in Supabase"],
                ["Default timezone", "Europe/Berlin"],
                ["Default currency", "EUR · integer cents"],
              ].map(([label, value]) => (
                <label
                  key={label}
                  className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#6b7671]"
                >
                  {label}
                  <input className="form-control mt-2" defaultValue={value} />
                </label>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus size={16} className="text-[#16856b]" />
                <h2 className="text-sm font-semibold">Members & roles</h2>
              </div>
              <button className="rounded-lg bg-[#13201d] px-3 py-2 text-xs font-semibold text-white">
                Invite member
              </button>
            </div>
            <div className="mt-4 divide-y divide-[#e3e0d8]">
              {[
                [
                  "Maxwell · you",
                  "mock.admin@example.com",
                  "Admin · MFA required",
                ],
                ["Lea Baumann", "lea@example.com", "Analyst"],
                [
                  "Investment Committee",
                  "ic@example.com",
                  "Viewer · contacts hidden",
                ],
              ].map(([name, email, role]) => (
                <div
                  key={email}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-xs font-semibold">{name}</p>
                    <p className="mt-1 text-[10px] text-[#7b8581]">{email}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-[#42645b]">
                    {role}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-5">
            <div className="flex items-center gap-2">
              <KeyRound size={16} className="text-[#16856b]" />
              <h2 className="text-sm font-semibold">
                Provider cost configuration
              </h2>
            </div>
            <p className="mt-2 text-xs text-[#68736e]">
              Editable estimates; provider invoices remain authoritative.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Advanced search", "10"],
                ["Company details", "10"],
                ["Financials", "10"],
                ["Owners", "10"],
              ].map(([label, cost]) => (
                <label
                  key={label}
                  className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#6b7671]"
                >
                  {label}
                  <span className="mt-2 flex items-center rounded-lg border border-[#d8d5cd] bg-white pr-3">
                    <input
                      className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                      defaultValue={cost}
                    />
                    <span className="text-[10px] text-[#77817d]">credits</span>
                  </span>
                </label>
              ))}
            </div>
            <button className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#087b62]">
              <CheckCircle2 size={13} /> Save provider rates
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
