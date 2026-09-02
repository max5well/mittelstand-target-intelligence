import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

const sections = [
  {
    title: "Verantwortlicher und Kontakt",
    content: (
      <p>
        Zielunternehmen ist ein privater Arbeitsbereich von DGE Technology. Bei
        Fragen zum Datenschutz oder zur Löschung Ihrer Daten erreichen Sie uns
        unter{" "}
        <a
          className="font-medium text-[#13745f] underline underline-offset-4"
          href="mailto:maximiliandev5@gmail.com"
        >
          maximiliandev5@gmail.com
        </a>
        .
      </p>
    ),
  },
  {
    title: "Welche Daten verarbeitet werden",
    content: (
      <p>
        Bei der Anmeldung verarbeiten wir die von Google bereitgestellte
        E-Mail-Adresse sowie grundlegende Profildaten. Im Arbeitsbereich werden
        außerdem die von berechtigten Nutzern eingegebenen Unternehmensdaten,
        Bewertungen und technische Protokolldaten verarbeitet.
      </p>
    ),
  },
  {
    title: "Zweck und Rechtsgrundlage",
    content: (
      <p>
        Die Verarbeitung dient der sicheren Zugangskontrolle und dem Betrieb des
        internen Target-Intelligence-Arbeitsbereichs. Sie erfolgt zur Wahrung
        berechtigter Interessen an einem sicheren, nachvollziehbaren und
        kollaborativen Akquisitionsprozess.
      </p>
    ),
  },
  {
    title: "Dienstleister und Übermittlung",
    content: (
      <p>
        Für Authentifizierung, Hosting und Datenhaltung nutzen wir Google,
        Vercel und Supabase. Dabei können Daten entsprechend deren
        Auftragsverarbeitungs- und Datenschutzbedingungen verarbeitet werden.
        Der Zugriff auf die Anwendung ist zusätzlich auf ausdrücklich
        freigegebene E-Mail-Adressen beschränkt.
      </p>
    ),
  },
  {
    title: "Speicherdauer und Rechte",
    content: (
      <p>
        Personenbezogene Daten werden nur so lange gespeichert, wie sie für den
        Betrieb, die Sicherheit oder gesetzliche Pflichten erforderlich sind.
        Sie können Auskunft, Berichtigung, Löschung, Einschränkung oder
        Widerspruch verlangen und sich bei einer Datenschutzaufsichtsbehörde
        beschweren.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f3f0e8] text-[#1d2522]">
      <header className="border-b border-white/12 bg-[#15352e] text-white">
        <div className="mx-auto flex h-24 max-w-[960px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark inverse className="size-9" />
            <span className="font-semibold">Zielunternehmen</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/70 transition hover:text-white"
          >
            <ArrowLeft size={15} /> Zur Startseite
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-[760px] px-5 py-16 sm:px-8 sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#13745f]">
          Rechtliche Informationen
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-.04em] sm:text-5xl">
          Datenschutzhinweise
        </h1>
        <p className="mt-5 text-sm text-[#697570]">Stand: 2. September 2026</p>

        <div className="mt-12 divide-y divide-[#d8d5cc] border-y border-[#d8d5cc]">
          {sections.map((section) => (
            <section key={section.title} className="py-8">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <div className="mt-3 text-sm leading-7 text-[#5f6b67]">
                {section.content}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
