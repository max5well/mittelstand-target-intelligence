"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard rendering failed", error);
  }, [error]);

  return (
    <main className="grid min-h-[60vh] place-items-center p-6">
      <section className="max-w-lg rounded-2xl border border-[#d8d5cc] bg-[#faf9f6] p-7 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Ansicht nicht verfügbar</h1>
        <p className="mt-3 text-sm leading-6 text-[#68736e]">
          Die Daten konnten vorübergehend nicht geladen werden. Es wurden keine
          technischen Details angezeigt.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-5 rounded-lg bg-[#15352e] px-4 py-2 text-sm font-semibold text-white"
        >
          Erneut versuchen
        </button>
        {error.digest ? (
          <p className="mt-4 text-xs text-[#7a8580]">
            Fehler-ID: {error.digest}
          </p>
        ) : null}
      </section>
    </main>
  );
}
