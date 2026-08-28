"use client";

import { useMemo, useRef, useState } from "react";
import { LocateFixed, MapPin, X } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import {
  Map,
  Marker,
  NavigationControl,
  type MapRef,
} from "react-map-gl/maplibre";
import type { Company } from "@/lib/types";

const GERMANY_BOUNDS: [[number, number], [number, number]] = [
  [5.5, 47.2],
  [15.5, 55.2],
];

const BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
    },
  },
  layers: [
    {
      id: "osm-basemap",
      type: "raster",
      source: "osm",
      paint: {
        "raster-saturation": -0.55,
        "raster-contrast": -0.08,
        "raster-brightness-min": 0.08,
        "raster-brightness-max": 0.95,
      },
    },
  ],
};

type MarkerGroup = {
  key: string;
  latitude: number;
  longitude: number;
  companies: Company[];
};

export function GermanyMap({ companies }: { companies: Company[] }) {
  const mapRef = useRef<MapRef>(null);
  const [selected, setSelected] = useState<MarkerGroup | null>(null);
  const [mode, setMode] = useState<"status" | "ownership" | "score">("status");
  const [mapError, setMapError] = useState(false);

  const located = useMemo(
    () =>
      companies.filter(
        (company) => company.latitude !== null && company.longitude !== null,
      ),
    [companies],
  );

  const markerGroups = useMemo(() => {
    const groups = new globalThis.Map<string, Company[]>();
    for (const company of located) {
      const group = groups.get(company.city) ?? [];
      group.push(company);
      groups.set(company.city, group);
    }
    return Array.from(groups, ([key, groupedCompanies]) => ({
      key,
      latitude:
        groupedCompanies.reduce(
          (sum, company) => sum + (company.latitude ?? 0),
          0,
        ) / groupedCompanies.length,
      longitude:
        groupedCompanies.reduce(
          (sum, company) => sum + (company.longitude ?? 0),
          0,
        ) / groupedCompanies.length,
      companies: groupedCompanies,
    }));
  }, [located]);

  function markerColor(group: MarkerGroup) {
    const company = [...group.companies].sort(
      (left, right) => (right.score ?? 0) - (left.score ?? 0),
    )[0];
    return mode === "score"
      ? company.score && company.score >= 80
        ? "#10a77f"
        : company.score && company.score >= 65
          ? "#d6a936"
          : "#7f8b86"
      : mode === "ownership"
        ? company.ownership.includes("Family")
          ? "#1f9d7a"
          : company.ownership.includes("PE-backed")
            ? "#8065b0"
            : "#477b8c"
        : group.companies.some((item) => item.status === "shortlisted")
          ? "#08a77c"
          : group.companies.every((item) => item.status === "passed")
            ? "#7f8b86"
            : "#327187";
  }

  function fitResults() {
    if (!located.length) return;
    const longitudes = located.map((company) => company.longitude!);
    const latitudes = located.map((company) => company.latitude!);
    mapRef.current?.fitBounds(
      [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
      ],
      {
        padding: { top: 110, right: 80, bottom: 80, left: 80 },
        duration: 700,
        maxZoom: 7.5,
      },
    );
  }

  return (
    <div className="relative h-[620px] min-h-[520px] overflow-hidden rounded-xl border border-[#c9cec9] bg-[#dfe9e5] shadow-[0_14px_50px_rgba(31,55,48,.08)] md:h-[720px]">
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        mapStyle={BASEMAP_STYLE}
        initialViewState={{
          bounds: GERMANY_BOUNDS,
          fitBoundsOptions: {
            padding: { top: 88, right: 52, bottom: 58, left: 52 },
          },
        }}
        maxBounds={[2.5, 44.5, 18.5, 57.5]}
        minZoom={4.2}
        maxZoom={13}
        dragRotate={false}
        pitchWithRotate={false}
        renderWorldCopies={false}
        attributionControl={{ compact: true }}
        onError={() => setMapError(true)}
        onLoad={() => setMapError(false)}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {markerGroups.map((group) => (
          <Marker
            key={group.key}
            latitude={group.latitude}
            longitude={group.longitude}
            anchor="center"
          >
            <button
              onClick={() => setSelected(group)}
              aria-label={`${group.companies.length} Unternehmen bei ${group.key} öffnen`}
              className="group grid size-9 place-items-center rounded-full border-[3px] border-white text-xs font-bold text-white shadow-[0_7px_18px_rgba(20,34,30,.28)] transition hover:scale-110 focus-visible:scale-110 md:size-10"
              style={{ background: markerColor(group) }}
            >
              {group.companies.length}
            </button>
          </Marker>
        ))}
      </Map>

      <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-72px)] flex-wrap gap-1.5 rounded-lg border border-[#d5d2ca] bg-[#faf9f6]/95 p-2 shadow-md backdrop-blur md:left-4 md:top-4 md:gap-2">
        {(["status", "ownership", "score"] as const).map((item) => (
          <button
            key={item}
            onClick={() => setMode(item)}
            aria-pressed={mode === item}
            className={`rounded px-3 py-1.5 text-xs font-semibold capitalize ${mode === item ? "bg-[#14221e] text-white" : "text-[#63706b] hover:bg-[#ecebe5]"}`}
          >
            {item === "status"
              ? "Status"
              : item === "ownership"
                ? "Eigentümer"
                : "Score"}
          </button>
        ))}
        <button
          onClick={fitResults}
          className="flex items-center gap-1 border-l border-[#d8d5cd] pl-3 text-xs font-semibold text-[#42645b] hover:text-[#0c725b]"
        >
          <LocateFixed size={12} /> Ergebnisse einpassen
        </button>
      </div>

      <div className="absolute bottom-7 left-3 z-10 max-w-[calc(100%-28px)] rounded-lg border border-[#d4d1c9] bg-[#faf9f6]/95 px-3 py-2 text-xs text-[#53625d] shadow-sm backdrop-blur md:bottom-4 md:left-4">
        {located.length} verortet · {companies.length - located.length} müssen
        geocodiert werden
      </div>

      {mapError && (
        <div className="absolute bottom-16 left-3 z-10 rounded-lg border border-[#e3c581] bg-[#fff6db] px-3 py-2 text-xs text-[#735a1c] md:left-4">
          Die Basiskarte konnte nicht geladen werden. Prüfen Sie die
          Netzwerkverbindung und versuchen Sie es erneut.
        </div>
      )}

      {selected && (
        <div className="absolute bottom-16 right-3 top-auto z-20 max-h-[70%] w-[min(320px,calc(100%-24px))] overflow-y-auto rounded-xl border border-[#d4d1c9] bg-[#faf9f6] p-4 shadow-2xl md:bottom-auto md:right-4 md:top-16">
          <button
            aria-label="Vorschau schließen"
            onClick={() => setSelected(null)}
            className="absolute right-3 top-3 rounded p-1 text-[#64716c] hover:bg-[#ecebe5]"
          >
            <X size={14} />
          </button>
          <div className="flex items-center gap-2 pr-7 text-[#16856b]">
            <MapPin size={14} />
            <p className="text-xs font-semibold uppercase tracking-[.1em]">
              {selected.key} · {selected.companies.length} Zielunternehmen
            </p>
          </div>
          <div className="mt-3 divide-y divide-[#dedbd3]">
            {selected.companies.map((company) => (
              <div key={company.id} className="py-3 first:pt-1 last:pb-0">
                <p className="pr-4 text-sm font-semibold">{company.name}</p>
                <p className="mt-1 text-xs leading-5 text-[#6a746f]">
                  {company.industry} · {company.employees ?? "Nicht gemeldet"}{" "}
                  Beschäftigte · Eignung{" "}
                  {company.score ?? "unzureichende Daten"}
                </p>
                <a
                  href={`/companies/${company.id}`}
                  className="mt-2 inline-block text-xs font-semibold text-[#087b62] hover:underline"
                >
                  Unternehmen öffnen →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
