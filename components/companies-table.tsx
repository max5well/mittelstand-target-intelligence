"use client";

import { useCallback, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Search,
  Star,
} from "lucide-react";
import Link from "next/link";
import type { Company, PipelineStatus } from "@/lib/types";
import {
  formatMoney,
  formatPercent,
  ownershipLabel,
  statusLabel,
} from "@/lib/format";
import { companiesToCsv } from "@/lib/company-csv";

const allStatuses: Array<PipelineStatus | "all"> = [
  "all",
  "new",
  "reviewed",
  "shortlisted",
  "contacted",
  "in_conversation",
  "nda",
  "diligence",
  "passed",
];

const columnLabels: Record<string, string> = {
  city: "Standort",
  industry: "Branche",
  employees: "Beschäftigte",
  revenueCents: "Umsatz",
  ebitdaCents: "EBITDA",
  ownership: "Eigentümerstruktur",
  status: "Status",
  score: "Eignung",
};

export function CompaniesTable({
  initialCompanies,
  workspaceId,
}: {
  initialCompanies: Company[];
  workspaceId: string;
}) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [pendingFavorites, setPendingFavorites] = useState<Set<string>>(
    () => new Set(),
  );
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PipelineStatus | "all">("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "score", desc: true },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const toggleFavorite = useCallback(
    async (companyId: string, favorite: boolean) => {
      setFavoriteError(null);
      setPendingFavorites((current) => new Set(current).add(companyId));
      setCompanies((current) =>
        current.map((company) =>
          company.id === companyId ? { ...company, favorite } : company,
        ),
      );

      try {
        const response = await fetch(`/api/companies/${companyId}/favorite`, {
          method: favorite ? "PUT" : "DELETE",
          headers: { "x-workspace-id": workspaceId },
        });
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(
            result.error ??
              "Der Favoritenstatus konnte nicht gespeichert werden.",
          );
        }
      } catch (error) {
        setCompanies((current) =>
          current.map((company) =>
            company.id === companyId
              ? { ...company, favorite: !favorite }
              : company,
          ),
        );
        setFavoriteError(
          error instanceof Error
            ? error.message
            : "Der Favoritenstatus konnte nicht gespeichert werden.",
        );
      } finally {
        setPendingFavorites((current) => {
          const next = new Set(current);
          next.delete(companyId);
          return next;
        });
      }
    },
    [workspaceId],
  );

  const filtered = useMemo(
    () =>
      companies.filter((company) => {
        const term = query.toLocaleLowerCase("de");
        const matchesQuery = [
          company.name,
          company.city,
          company.industry,
          company.openregisterCompanyId,
          company.ownerSummary,
        ].some((value) => value.toLocaleLowerCase("de").includes(term));
        return (
          matchesQuery &&
          (status === "all" || company.status === status) &&
          (!favoritesOnly || company.favorite)
        );
      }),
    [companies, query, status, favoritesOnly],
  );

  const columns = useMemo<ColumnDef<Company>[]>(
    () => [
      {
        id: "favorite",
        enableHiding: false,
        header: "",
        cell: ({ row }) => (
          <button
            type="button"
            aria-label={
              row.original.favorite
                ? "Aus Favoriten entfernen"
                : "Zu Favoriten hinzufügen"
            }
            aria-pressed={row.original.favorite}
            disabled={pendingFavorites.has(row.original.id)}
            onClick={() =>
              toggleFavorite(row.original.id, !row.original.favorite)
            }
            className="grid size-8 place-items-center rounded-md text-[#b48b24] transition hover:bg-[#fff2c7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b48b24] disabled:cursor-wait disabled:opacity-55"
          >
            <Star
              size={15}
              fill={row.original.favorite ? "currentColor" : "none"}
            />
          </button>
        ),
      },
      {
        accessorKey: "name",
        enableHiding: false,
        header: "Unternehmen",
        cell: ({ row }) => (
          <div className="min-w-[260px]">
            <Link
              href={`/companies/${row.original.id}`}
              className="font-semibold text-[#1d2926] hover:text-[#087b62]"
            >
              {row.original.name}
            </Link>
            <p className="mt-1 text-xs text-[#84908b]">
              {row.original.registerReference} · {row.original.registerCourt} ·{" "}
              {row.original.legalForm}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "city",
        header: "Standort",
        cell: ({ row }) => (
          <div>
            <p>{row.original.city}</p>
            <p className="mt-1 text-xs text-[#84908b]">{row.original.state}</p>
          </div>
        ),
      },
      {
        accessorKey: "industry",
        header: "Branche",
        cell: ({ row }) => (
          <div className="min-w-[180px]">
            <p>{row.original.industry}</p>
          </div>
        ),
      },
      {
        accessorKey: "employees",
        header: "Beschäftigte",
        cell: ({ row }) =>
          row.original.employees === null ? (
            <span title="Nicht verfügbar" className="text-[#8d9692]">
              N/V
            </span>
          ) : (
            <div className="text-right tabular-nums">
              <p>{row.original.employees}</p>
              <p className="mt-1 text-xs text-[#84908b]">
                Gemeldet · {row.original.employeeYear}
              </p>
            </div>
          ),
      },
      {
        accessorKey: "revenueCents",
        header: "Umsatz",
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            <p>{formatMoney(row.original.revenueCents)}</p>
            <p className="mt-1 text-xs text-[#84908b]">
              {row.original.revenueCents === null
                ? "N/V"
                : `Gemeldet · ${row.original.fiscalYear}`}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "ebitdaCents",
        header: "EBITDA",
        cell: ({ row }) => {
          const margin = formatPercent(
            row.original.ebitdaCents && row.original.revenueCents
              ? row.original.ebitdaCents / row.original.revenueCents
              : null,
          );
          return (
            <div className="text-right tabular-nums">
              <p>{formatMoney(row.original.ebitdaCents)}</p>
              <p className="mt-1 text-xs text-[#84908b]">
                {margin === "N/V" ? "N/V" : `${margin} Marge`}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "ownership",
        header: "Eigentümerstruktur",
        cell: ({ row }) => (
          <div className="min-w-[190px]">
            <p>{ownershipLabel(row.original.ownership)}</p>
            <p className="mt-1 text-xs text-[#84908b]">
              {row.original.ownershipMethod === "rules"
                ? "Regelbasierte Klassifizierung"
                : row.original.ownershipMethod === "openregister_flag"
                  ? "OpenRegister-Klassifizierung"
                  : row.original.ownershipMethod === "ai_with_evidence"
                    ? "Evidenzbasierte Klassifizierung"
                    : "Analystenklassifizierung"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span className="rounded-full bg-[#e7eee9] px-2.5 py-1.5 text-xs font-semibold text-[#385f54]">
            {statusLabel(row.original.status)}
          </span>
        ),
      },
      {
        accessorKey: "score",
        header: "Eignung",
        cell: ({ row }) =>
          row.original.score === null ? (
            <span title="Unzureichende Daten" className="text-[#8d9692]">
              N/V
            </span>
          ) : (
            <span className="grid size-8 place-items-center rounded-full border border-[#afd8cc] font-semibold text-[#087b62]">
              {row.original.score}
            </span>
          ),
      },
    ],
    [pendingFavorites, toggleFavorite],
  );

  // TanStack Table intentionally returns stateful functions; React Compiler skips this hook.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table
    .getRowModel()
    .rows.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  function exportCsv() {
    const sortedCompanies = table.getRowModel().rows.map((row) => row.original);
    const blob = new Blob(["\uFEFF", companiesToCsv(sortedCompanies)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `unternehmen-targets-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-[#d6d3cb] bg-[#faf9f6]">
      {favoriteError ? (
        <p
          role="alert"
          className="border-b border-[#efc7bf] bg-[#f9e9e6] px-4 py-3 text-xs text-[#8b3f35]"
        >
          {favoriteError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#dfddd6] p-4">
        <label className="flex h-9 min-w-[260px] flex-1 items-center gap-2 rounded-lg border border-[#d7d4cc] bg-white px-3 text-xs text-[#707a76]">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Unternehmen, Stadt, Eigentümer oder Register-ID suchen…"
            className="w-full bg-transparent outline-none"
          />
        </label>
        <select
          aria-label="Nach Status filtern"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as PipelineStatus | "all");
            setPage(0);
          }}
          className="h-9 rounded-lg border border-[#d7d4cc] bg-white px-3 text-xs"
        >
          {allStatuses.map((item) => (
            <option key={item} value={item}>
              {item === "all" ? "Alle Status" : statusLabel(item)}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setFavoritesOnly((value) => !value);
            setPage(0);
          }}
          className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs ${favoritesOnly ? "border-[#b89b4c] bg-[#fff7dc] text-[#6e571a]" : "border-[#d7d4cc] bg-white"}`}
        >
          <Star size={13} fill={favoritesOnly ? "currentColor" : "none"} />{" "}
          Favoriten
        </button>
        <details className="group relative">
          <summary className="flex h-9 list-none items-center gap-2 rounded-lg border border-[#d7d4cc] bg-white px-3 text-xs [&::-webkit-details-marker]:hidden">
            <Columns3 size={13} /> Spalten
          </summary>
          <div className="absolute right-0 top-11 z-30 w-52 rounded-lg border border-[#d7d4cc] bg-white p-2 shadow-xl">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[.1em] text-[#77817d]">
              Sichtbare Spalten
            </p>
            {table
              .getAllLeafColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <label
                  key={column.id}
                  className="flex items-center gap-2 rounded px-2 py-2 text-xs hover:bg-[#f3f2ed]"
                >
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                  />
                  {columnLabels[column.id] ?? column.id}
                </label>
              ))}
          </div>
        </details>
        <button
          onClick={exportCsv}
          className="flex h-9 items-center gap-2 rounded-lg border border-[#d7d4cc] bg-white px-3 text-xs"
        >
          <Download size={13} /> CSV exportieren
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1450px] text-left text-xs">
          <thead className="sticky top-0 bg-[#f4f2ed] text-[#75807c]">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-[#dedbd3] px-4 py-3 font-medium"
                  >
                    <button
                      className="flex items-center gap-1"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getCanSort() && <ArrowDownUp size={10} />}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[#e6e3dc] transition hover:bg-[#f3f7f4]"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3.5 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 py-3 text-xs text-[#6d7773]">
        <p>
          {filtered.length} freigegebene Unternehmen · Seite {page + 1} von{" "}
          {totalPages}
        </p>
        <div className="flex gap-1">
          <button
            disabled={page === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            className="grid size-8 place-items-center rounded border border-[#d7d4cc] bg-white disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            disabled={page + 1 >= totalPages}
            onClick={() =>
              setPage((value) => Math.min(totalPages - 1, value + 1))
            }
            className="grid size-8 place-items-center rounded border border-[#d7d4cc] bg-white disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
