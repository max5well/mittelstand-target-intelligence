"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function AddTargetButton({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    if (!name || !city) return;
    setSaving(true);
    setError(null);
    const response = await fetch("/api/companies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": workspaceId,
      },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    const result = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(
        result.error ?? "Das Unternehmen konnte nicht hinzugefügt werden",
      );
      return;
    }
    setOpen(false);
    setNotice(`${name} wurde gespeichert.`);
    router.refresh();
    window.setTimeout(() => setNotice(null), 4500);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#15352e] px-4 text-sm font-medium text-white"
      >
        <Plus size={15} /> Ziel hinzufügen
      </button>
      {notice && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 rounded-lg bg-[#143329] px-4 py-3 text-xs text-white shadow-xl"
        >
          {notice}
        </div>
      )}
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#101b18]/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-target-title"
        >
          <form
            action={submit}
            className="w-full max-w-xl rounded-2xl border border-[#d7d4cc] bg-[#f8f6f0] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.13em] text-[#13745f]">
                  Manuelles Ziel
                </p>
                <h2
                  id="add-target-title"
                  className="mt-1 text-xl font-semibold"
                >
                  Unternehmen hinzufügen
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Dialog zum Hinzufügen schließen"
                className="rounded-lg border border-[#d7d4cc] bg-white p-2"
              >
                <X size={14} />
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#68736e]">
              Dadurch wird ein dauerhaftes manuelles Ziel angelegt. Die
              Anbieteranreicherung bleibt deaktiviert, bis eine passende
              OpenRegister-Unternehmens-ID verknüpft ist.
            </p>
            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-[#efc7bf] bg-[#f9e9e6] p-3 text-sm text-[#8b3f35]"
              >
                {error}
              </p>
            )}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Unternehmensname" name="name" required />
              <label className="text-xs font-semibold uppercase tracking-[.1em] text-[#6b7671]">
                Rechtsform
                <select name="legalForm" className="form-control mt-2">
                  <option>GmbH</option>
                  <option>AG</option>
                  <option>GmbH & Co. KG</option>
                  <option>KG</option>
                </select>
              </label>
              <Field label="Stadt" name="city" required />
              <Field label="Bundesland" name="state" />
              <Field label="Postleitzahl" name="postcode" />
              <Field label="WZ-2025-Code" name="industryCode" />
              <Field label="Branche" name="industry" />
              <Field label="Website" name="website" type="url" />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 rounded-lg border border-[#d7d4cc] bg-white px-4 text-xs font-semibold"
              >
                Abbrechen
              </button>
              <button
                disabled={saving}
                className="h-10 rounded-lg bg-[#15352e] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Wird gespeichert…" : "Ziel hinzufügen"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-xs font-semibold uppercase tracking-[.08em] text-[#6b7671]">
      {label}
      <input
        className="form-control mt-2"
        name={name}
        type={type}
        required={required}
      />
    </label>
  );
}
