"use client";

import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  DatabaseZap,
  Globe2,
  Map,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { label: "Übersicht", href: "/overview", icon: BarChart3 },
  { label: "Unternehmen", href: "/companies", icon: Building2 },
  { label: "Karte", href: "/map", icon: Map },
  { label: "Analysen", href: "/analytics", icon: Globe2 },
  { label: "Gespeicherte Suchen", href: "/searches", icon: SlidersHorizontal },
  { label: "Log", href: "/jobs", icon: DatabaseZap },
];

export function AppShell({
  children,
  userEmail = "mock.admin@example.com",
}: {
  children: ReactNode;
  userEmail?: string;
}) {
  const pathname = usePathname();
  return (
    <main className="min-h-screen bg-[#f3f1eb] text-[#18201e]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[244px] flex-col bg-[#13201d] text-white lg:flex">
        <Link
          href="/overview"
          className="flex h-20 items-center gap-3 border-b border-white/10 px-6"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-[#30c7a1] text-[#0e1b18]">
            <Building2 size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-wide">Unternehmen</p>
            <p className="text-xs uppercase tracking-[.14em] text-white/55">
              Zielmarkt-Intelligence
            </p>
          </div>
        </Link>
        <nav
          aria-label="Hauptnavigation"
          className="space-y-1 px-3 py-6 text-sm"
        >
          {navigation.map(({ label, href, icon: Icon }) => {
            const active =
              pathname === href ||
              (href === "/companies" && pathname.startsWith("/companies/"));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition ${active ? "bg-white/10 text-white" : "text-white/58 hover:bg-white/5 hover:text-white"}`}
              >
                <Icon size={15} className={active ? "text-[#45d1ad]" : ""} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3 border-t border-white/10 p-4">
          <Link
            href="/settings?section=integrations"
            className="block rounded-xl bg-white/[.05] p-3 transition hover:bg-white/[.08]"
          >
            <p className="text-xs font-medium">Datenintegrationen</p>
            <p className="mt-1 text-xs text-white/45">
              Konfiguration und Prüfstatus anzeigen
            </p>
          </Link>
          <Link
            href="/settings"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${pathname === "/settings" ? "bg-white/10 text-white" : "text-white/58 hover:text-white"}`}
          >
            <Settings size={15} />
            Einstellungen
          </Link>
        </div>
      </aside>
      <section className="lg:pl-[244px]">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-[#dedbd2] bg-[#f8f7f3]/90 px-5 backdrop-blur md:px-9">
          <div className="flex items-center gap-3">
            <BriefcaseBusiness size={16} className="text-[#16856b]" />
            <div>
              <p className="text-xs font-medium uppercase tracking-[.12em] text-[#75807c]">
                Investment-Arbeitsbereich
              </p>
              <p className="mt-0.5 text-sm font-semibold">DACH Industrials I</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              title={userEmail}
              className="grid size-9 place-items-center rounded-full bg-[#dcebe5] text-xs font-semibold text-[#1b6452]"
            >
              MS
            </div>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[.12em] text-[#16856b]">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-[-.035em] md:text-[38px]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64706c]">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
