"use client";

import { useMemo, useState } from "react";
import { LocateFixed, MapPin, X } from "lucide-react";
import type { Company } from "@/lib/types";

const GERMANY_BOUNDS = {
  minLat: 47.2,
  maxLat: 55.2,
  minLng: 5.5,
  maxLng: 15.5,
} as const;

export function GermanyMap({ companies }: { companies: Company[] }) {
  const [selected, setSelected] = useState<Company | null>(null);
  const [mode, setMode] = useState<"status" | "ownership" | "score">("status");
  const located = companies.filter(
    (company) => company.latitude !== null && company.longitude !== null,
  );
  const markers = useMemo(
    () =>
      located.map((company) => ({
        company,
        x:
          ((company.longitude! - GERMANY_BOUNDS.minLng) /
            (GERMANY_BOUNDS.maxLng - GERMANY_BOUNDS.minLng)) *
          100,
        y:
          (1 -
            (company.latitude! - GERMANY_BOUNDS.minLat) /
              (GERMANY_BOUNDS.maxLat - GERMANY_BOUNDS.minLat)) *
          100,
      })),
    [located],
  );
  const color = (company: Company) =>
    mode === "score"
      ? company.score && company.score >= 80
        ? "#10a77f"
        : company.score && company.score >= 65
          ? "#d6a936"
          : "#9aa49f"
      : mode === "ownership"
        ? company.ownership.includes("Family")
          ? "#1f9d7a"
          : company.ownership.includes("PE-backed")
            ? "#8065b0"
            : "#477b8c"
        : company.status === "shortlisted"
          ? "#08a77c"
          : company.status === "passed"
            ? "#a1aaa6"
            : "#327187";
  return (
    <div className="relative min-h-[650px] overflow-hidden rounded-xl border border-[#d4d1c9] bg-[#dfe9e5]">
      <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2 rounded-lg border border-[#d5d2ca] bg-[#faf9f6]/95 p-2 shadow-sm">
        {(["status", "ownership", "score"] as const).map((item) => (
          <button
            key={item}
            onClick={() => setMode(item)}
            className={`rounded px-3 py-1.5 text-[10px] font-semibold capitalize ${mode === item ? "bg-[#14221e] text-white" : "text-[#63706b]"}`}
          >
            {item}
          </button>
        ))}
        <button className="ml-2 flex items-center gap-1 border-l border-[#d8d5cd] pl-3 text-[10px] font-semibold text-[#42645b]">
          <LocateFixed size={12} /> Fit results
        </button>
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(255,255,255,.75),transparent_32%),linear-gradient(135deg,transparent_25%,rgba(255,255,255,.28)_25%,rgba(255,255,255,.28)_26%,transparent_26%)] bg-[length:auto,38px_38px]" />
      <div className="absolute bottom-[5%] left-[17%] right-[17%] top-[5%] rounded-[47%_40%_50%_42%/26%_33%_42%_38%] border border-[#9fb5ad] bg-[#f5f3ec]/88 shadow-[0_20px_80px_rgba(38,66,57,.12)]" />
      {markers.map(({ company, x, y }) => (
        <button
          key={company.id}
          onClick={() => setSelected(company)}
          aria-label={`Open ${company.name}`}
          className="group absolute z-[2] -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${Math.max(18, Math.min(82, x))}%`,
            top: `${Math.max(7, Math.min(93, y))}%`,
          }}
        >
          <span
            className="grid size-8 place-items-center rounded-full border-2 border-white text-[9px] font-bold text-white shadow-lg transition group-hover:scale-110"
            style={{ background: color(company) }}
          >
            {company.city === "Berlin" || company.city === "Hamburg"
              ? "3"
              : "1"}
          </span>
        </button>
      ))}
      <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-[#d4d1c9] bg-[#faf9f6]/95 px-3 py-2 text-[10px] text-[#64716c]">
        {located.length} located · {companies.length - located.length} need
        geocoding review · cached mock coordinates
      </div>
      {selected && (
        <div className="absolute right-4 top-4 z-20 w-[290px] rounded-xl border border-[#d4d1c9] bg-[#faf9f6] p-4 shadow-xl">
          <button
            aria-label="Close preview"
            onClick={() => setSelected(null)}
            className="absolute right-3 top-3"
          >
            <X size={14} />
          </button>
          <div className="flex items-center gap-2 text-[#16856b]">
            <MapPin size={14} />
            <p className="text-[10px] font-semibold uppercase tracking-[.1em]">
              {selected.city}, {selected.state}
            </p>
          </div>
          <p className="mt-3 text-sm font-semibold">{selected.name}</p>
          <p className="mt-2 text-xs leading-5 text-[#6a746f]">
            {selected.industry} · {selected.employees ?? "Not reported"}{" "}
            employees · Fit {selected.score ?? "insufficient data"}
          </p>
          <a
            href={`/companies/${selected.id}`}
            className="mt-4 inline-block text-xs font-semibold text-[#087b62]"
          >
            Open company →
          </a>
        </div>
      )}
    </div>
  );
}
