import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  DatabaseZap,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f3f0e8] text-[#1d2522]">
      <section className="relative isolate min-h-[760px] bg-[#15352e] text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-90"
          style={{
            backgroundImage:
              "radial-gradient(circle at 82% 18%, rgba(36,184,148,.2), transparent 26%), radial-gradient(circle at 8% 82%, rgba(255,255,255,.07), transparent 30%)",
          }}
        />
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <header className="flex h-24 items-center justify-between border-b border-white/12">
            <Link
              href="/"
              className="flex items-center gap-3"
              aria-label="Zielunternehmen Startseite"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-white/8 p-1.5 ring-1 ring-white/12">
                <BrandMark inverse className="size-full" />
              </span>
              <span>
                <span className="block text-sm font-semibold tracking-wide">
                  Zielunternehmen
                </span>
                <span className="block text-[10px] uppercase tracking-[.18em] text-white/55">
                  Private Target Intelligence
                </span>
              </span>
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-white/25 px-4 py-2.5 text-sm font-semibold transition hover:border-[#24b894] hover:bg-[#24b894] hover:text-[#102a24]"
            >
              Anmelden
            </Link>
          </header>

          <div className="grid items-center gap-16 pb-24 pt-20 lg:grid-cols-[1.08fr_.92fr] lg:pt-28">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#24b894]/35 bg-[#24b894]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-[#8de0c9]">
                <ShieldCheck size={14} /> Für diskrete Akquisitionsprozesse
              </div>
              <h1 className="mt-7 max-w-[760px] text-5xl font-semibold leading-[1.03] tracking-[-.045em] sm:text-6xl lg:text-[72px]">
                Die richtigen Unternehmen. Klar priorisiert.
              </h1>
              <p className="mt-7 max-w-[650px] text-lg leading-8 text-white/68">
                Finden, bewerten und verfolgen Sie passende Unternehmen im
                deutschen Mittelstand — mit belastbaren Quellen, transparentem
                Scoring und einem gemeinsamen Zieluniversum.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#24b894] px-5 py-3 text-sm font-semibold text-[#102a24] transition hover:bg-[#47c7a7]"
                >
                  Zum Arbeitsbereich <ArrowRight size={16} />
                </Link>
                <p className="flex items-center gap-2 text-sm text-white/55">
                  <CheckCircle2 size={15} className="text-[#24b894]" />
                  Zugriff nur für freigegebene Konten
                </p>
              </div>
            </div>

            <div className="relative lg:pl-8">
              <div className="absolute -inset-8 -z-10 rounded-full bg-[#24b894]/10 blur-3xl" />
              <div className="overflow-hidden rounded-2xl border border-white/14 bg-[#f8f6f0] text-[#1d2522] shadow-[0_32px_90px_rgba(0,0,0,.28)]">
                <div className="flex items-center justify-between border-b border-[#dedbd3] px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.13em] text-[#13745f]">
                      Zieluniversum
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      Priorisierte Unternehmen
                    </p>
                  </div>
                  <span className="rounded-full bg-[#dff3ed] px-2.5 py-1 text-xs font-semibold text-[#13745f]">
                    Fiktive Beispieldaten
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-px bg-[#dedbd3]">
                  {[
                    ["Kandidaten", "148"],
                    ["Shortlist", "24"],
                    ["Im Dialog", "7"],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-[#f8f6f0] px-4 py-5">
                      <p className="text-[11px] text-[#78827f]">{label}</p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-[#e8e5de] px-5">
                  {[
                    ["Fiktivwerk Anlagenbau GmbH", "92", "Sehr hohe Eignung"],
                    ["Fiktivklima Systeme GmbH", "87", "Hohe Eignung"],
                    ["Fiktivdach Technik KG", "83", "Hohe Eignung"],
                    ["Fiktivservice Industrie GmbH", "78", "Prüfen"],
                  ].map(([name, score, label], index) => (
                    <div
                      key={name}
                      className="grid grid-cols-[32px_1fr_auto] items-center gap-3 py-4"
                    >
                      <span className="grid size-8 place-items-center rounded-lg bg-[#ece9e1] text-xs font-semibold text-[#6b7571]">
                        {index + 1}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">
                          {name}
                        </span>
                        <span className="mt-1 block text-xs text-[#7a8581]">
                          {label}
                        </span>
                      </span>
                      <span className="text-lg font-semibold text-[#13745f]">
                        {score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 sm:py-28">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#13745f]">
            Vom Markt zur Entscheidung
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-.03em] sm:text-4xl">
            Ein verlässlicher Blick auf jedes Zielunternehmen.
          </h2>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[#d8d5cc] bg-[#d8d5cc] md:grid-cols-3">
          {[
            {
              icon: SearchCheck,
              title: "Gezielt entdecken",
              copy: "Suchen Sie nach Branche, Region, Größe und Eigentümerstruktur — zugeschnitten auf Ihre Akquisitionsstrategie.",
            },
            {
              icon: DatabaseZap,
              title: "Quellenbasiert bewerten",
              copy: "Trennen Sie offizielle Registerdaten, externe Signale und Analysteneinschätzungen sauber voneinander.",
            },
            {
              icon: BarChart3,
              title: "Gemeinsam priorisieren",
              copy: "Führen Sie Favoriten, Pipeline und Scoring in einem privaten Arbeitsbereich für Ihr Team zusammen.",
            },
          ].map(({ icon: Icon, title, copy }) => (
            <article key={title} className="bg-[#faf9f6] p-7 sm:p-9">
              <span className="grid size-11 place-items-center rounded-xl bg-[#dff3ed] text-[#13745f]">
                <Icon size={21} />
              </span>
              <h3 className="mt-6 text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#697570]">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#d8d5cc] bg-[#ece9e1]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-5 py-8 text-sm text-[#68736f] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2 font-semibold text-[#15352e]">
            <BrandMark className="size-7" /> Zielunternehmen
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/datenschutz"
              className="underline-offset-4 hover:underline"
            >
              Datenschutz
            </Link>
            <p>Privater Zugang · DGE Technology</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
