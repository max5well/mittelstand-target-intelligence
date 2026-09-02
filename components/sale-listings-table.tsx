"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";
import type { SaleOpportunity } from "@/lib/types";

export function SaleListingsTable({
  initialListings,
}: {
  initialListings: SaleOpportunity[];
}) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("all");
  const [agent, setAgent] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "title", desc: false },
  ]);
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const locations = useMemo(
    () => uniqueOptions(initialListings.map((listing) => listing.location)),
    [initialListings],
  );
  const agents = useMemo(
    () => uniqueOptions(initialListings.map((listing) => listing.agentCompany)),
    [initialListings],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de");
    return initialListings.filter(
      (listing) =>
        (location === "all" || listing.location === location) &&
        (agent === "all" || listing.agentCompany === agent) &&
        (!needle ||
          [
            listing.title,
            listing.originalTitle,
            listing.description,
            listing.location,
            listing.industry,
            listing.agentCompany,
            listing.listingId,
          ].some((value) => value.toLocaleLowerCase("de").includes(needle))),
    );
  }, [agent, initialListings, location, query]);

  const columns = useMemo<ColumnDef<SaleOpportunity>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Angebot",
        cell: ({ row }) => (
          <div className="min-w-[220px] max-w-[280px]">
            <p className="font-semibold text-[#1d2926]">{row.original.title}</p>
            <p className="mt-1 text-xs text-[#84908b]">
              {row.original.listingId}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "description",
        header: "Kurzbeschreibung",
        cell: ({ row }) => (
          <p
            title={row.original.originalTitle}
            className="min-w-[300px] max-w-[390px] text-sm leading-5 text-[#596560]"
          >
            {row.original.description}
          </p>
        ),
      },
      {
        accessorKey: "location",
        header: "Standort",
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap">{String(getValue())}</span>
        ),
      },
      {
        accessorKey: "industry",
        header: "Branche",
        cell: ({ getValue }) => (
          <span className="block min-w-[180px]">{String(getValue())}</span>
        ),
      },
      {
        accessorKey: "employees",
        header: "Beschäftigte",
        sortUndefined: "last",
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.employees ?? "N/V"}
          </span>
        ),
      },
      {
        accessorKey: "revenueCents",
        header: "Umsatz",
        sortUndefined: "last",
        cell: ({ row }) => (
          <span className="block whitespace-nowrap text-right tabular-nums">
            {formatMoney(row.original.revenueCents)}
          </span>
        ),
      },
      {
        accessorKey: "ebitdaCents",
        header: "EBITDA",
        sortUndefined: "last",
        cell: ({ row }) => (
          <span className="block whitespace-nowrap text-right tabular-nums">
            {formatMoney(row.original.ebitdaCents)}
          </span>
        ),
      },
      {
        accessorKey: "askingPriceCents",
        header: "Kaufpreis",
        sortUndefined: "last",
        cell: ({ row }) => (
          <span className="block whitespace-nowrap text-right font-medium tabular-nums">
            {formatMoney(row.original.askingPriceCents)}
          </span>
        ),
      },
      {
        accessorKey: "agentCompany",
        header: "Verkaufsberater",
        cell: ({ getValue }) => (
          <span className="block min-w-[150px]">{String(getValue())}</span>
        ),
      },
      {
        id: "sourceUrl",
        enableSorting: false,
        header: "Inserat",
        cell: ({ row }) => (
          <a
            href={row.original.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`${row.original.title} beim Verkaufsberater öffnen`}
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#d1a04a] bg-[#fff4d8] px-2.5 text-xs font-semibold text-[#79520c] transition hover:bg-[#ffeab8]"
          >
            Öffnen <ExternalLink size={12} />
          </a>
        ),
      },
    ],
    [],
  );

  // TanStack Table intentionally returns stateful functions; React Compiler skips this hook.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visiblePage = Math.min(page, totalPages - 1);
  const rows = table
    .getRowModel()
    .rows.slice(visiblePage * pageSize, (visiblePage + 1) * pageSize);

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-[#d6d3cb] bg-[#faf9f6]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#dfddd6] p-4">
        <label className="flex h-9 min-w-[280px] flex-1 items-center gap-2 rounded-lg border border-[#d7d4cc] bg-white px-3 text-xs text-[#707a76]">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Titel, Beschreibung, Standort, Branche oder ID suchen…"
            className="w-full bg-transparent outline-none"
          />
        </label>
        <select
          aria-label="Nach Standort filtern"
          value={location}
          onChange={(event) => {
            setLocation(event.target.value);
            setPage(0);
          }}
          className="h-9 rounded-lg border border-[#d7d4cc] bg-white px-3 text-xs"
        >
          <option value="all">Alle Standorte</option>
          {locations.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          aria-label="Nach Verkaufsberater filtern"
          value={agent}
          onChange={(event) => {
            setAgent(event.target.value);
            setPage(0);
          }}
          className="h-9 rounded-lg border border-[#d7d4cc] bg-white px-3 text-xs"
        >
          <option value="all">Alle Verkaufsberater</option>
          {agents.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1660px] border-collapse text-left text-sm">
          <thead className="bg-[#f1efe9] text-xs uppercase tracking-[.06em] text-[#707a76]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 font-semibold">
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1.5"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        <ArrowDownUp size={12} />
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-[#e2e0d9] align-top transition hover:bg-[#f6f4ee]"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#dfddd6] px-4 py-3 text-xs text-[#68736e]">
        <p>
          {filtered.length} von {initialListings.length} deutschen Angeboten
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Vorherige Seite"
            disabled={visiblePage === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            className="grid size-8 place-items-center rounded-lg border border-[#d7d4cc] bg-white disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            Seite {visiblePage + 1} von {totalPages}
          </span>
          <button
            type="button"
            aria-label="Nächste Seite"
            disabled={visiblePage >= totalPages - 1}
            onClick={() =>
              setPage((current) => Math.min(totalPages - 1, current + 1))
            }
            className="grid size-8 place-items-center rounded-lg border border-[#d7d4cc] bg-white disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, "de"),
  );
}
