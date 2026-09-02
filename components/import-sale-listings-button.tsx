"use client";

import { RefreshCw, Tags } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ImportResult = {
  imported: number;
  updated: number;
  staleMarked: number;
  excludedNonGerman: number;
  error?: string;
};

export function ImportSaleListingsButton({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function synchronize() {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/providers/concess/import", {
        method: "POST",
        headers: { "x-workspace-id": workspaceId },
      });
      const result = (await response.json().catch(() => ({}))) as ImportResult;
      if (!response.ok)
        throw new Error(
          result.error ?? "Die Verkaufsangebote konnten nicht geladen werden.",
        );
      setNotice(
        `${result.imported} neue und ${result.updated} bekannte deutsche Verkaufsangebote synchronisiert. ${result.excludedNonGerman} nicht-deutsche Angebote wurden ausgeschlossen.`,
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Die Verkaufsangebote konnten nicht geladen werden.",
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={syncing}
        onClick={synchronize}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d1a04a] bg-[#fff4d8] px-4 text-sm font-semibold text-[#79520c] transition hover:bg-[#ffeab8] disabled:cursor-wait disabled:opacity-60"
      >
        {syncing ? (
          <RefreshCw size={15} className="animate-spin" />
        ) : (
          <Tags size={15} />
        )}
        {syncing ? "Angebote werden geladen…" : "Verkaufsangebote laden"}
      </button>
      {notice ? (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 max-w-md rounded-lg bg-[#143329] px-4 py-3 text-xs leading-5 text-white shadow-xl"
        >
          {notice}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="fixed bottom-5 right-5 z-50 max-w-md rounded-lg bg-[#8b3f35] px-4 py-3 text-xs leading-5 text-white shadow-xl"
        >
          {error}
        </div>
      ) : null}
    </>
  );
}
