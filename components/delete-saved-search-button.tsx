"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function DeleteSavedSearchButton({
  searchId,
  searchName,
  workspaceId,
}: {
  searchId: string;
  searchName: string;
  workspaceId: string;
}) {
  const router = useRouter();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) cancelButtonRef.current?.focus();
  }, [open]);

  function closeDialog() {
    if (deleting) return;
    setOpen(false);
    setError(null);
    triggerButtonRef.current?.focus();
  }

  async function deleteSearch() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/searches/${searchId}`, {
        method: "DELETE",
        headers: { "x-workspace-id": workspaceId },
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(
          result.error ?? "Gespeicherte Suche konnte nicht gelöscht werden.",
        );
      }
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Gespeicherte Suche konnte nicht gelöscht werden.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        ref={triggerButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d7bcb6] bg-white px-3 text-xs font-semibold text-[#8b3f35] transition-colors hover:bg-[#f9e9e6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b3f35]"
        aria-label={`Gespeicherte Suche „${searchName}“ löschen`}
      >
        <Trash2 size={14} aria-hidden="true" />
        Löschen
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#101b18]/45 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={`delete-search-title-${searchId}`}
          aria-describedby={`delete-search-description-${searchId}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeDialog();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-[#d7d4cc] bg-[#f8f6f0] p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[.13em] text-[#a34b40]">
              Löschen bestätigen
            </p>
            <h2
              id={`delete-search-title-${searchId}`}
              className="mt-2 text-xl font-semibold"
            >
              „{searchName}“ löschen?
            </h2>
            <p
              id={`delete-search-description-${searchId}`}
              className="mt-3 text-sm leading-6 text-[#68736e]"
            >
              Die gespeicherte Suche und ihre Ausführungshistorie werden
              dauerhaft entfernt. Bereits gefundene Unternehmen bleiben
              erhalten. Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-[#efc7bf] bg-[#f9e9e6] p-3 text-sm text-[#8b3f35]"
              >
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={closeDialog}
                disabled={deleting}
                className="h-10 rounded-lg border border-[#d7d4cc] bg-white px-4 text-xs font-semibold disabled:opacity-60"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => void deleteSearch()}
                disabled={deleting}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#a34b40] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deleting ? (
                  <LoaderCircle
                    size={15}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Trash2 size={15} aria-hidden="true" />
                )}
                {deleting ? "Wird gelöscht…" : "Endgültig löschen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
