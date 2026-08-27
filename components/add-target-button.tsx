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
      headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    const result = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(result.error ?? "Unable to add the company");
      return;
    }
    setOpen(false);
    setNotice(`${name} was saved.`);
    router.refresh();
    window.setTimeout(() => setNotice(null), 4500);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#13201d] px-4 text-sm font-medium text-white"
      >
        <Plus size={15} /> Add target
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
            className="w-full max-w-xl rounded-2xl border border-[#d7d4cc] bg-[#f8f7f3] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.13em] text-[#16856b]">
                  Manual target
                </p>
                <h2 id="add-target-title" className="mt-1 text-xl font-semibold">
                  Add a company
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close add target dialog"
                className="rounded-lg border border-[#d7d4cc] bg-white p-2"
              >
                <X size={14} />
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#68736e]">This creates a durable manual target. Provider enrichment remains unavailable until a matching OpenRegister company ID is attached.</p>
            {error && <p role="alert" className="mt-3 rounded-lg border border-[#efc7bf] bg-[#f9e9e6] p-3 text-sm text-[#8b3f35]">{error}</p>}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Company name" name="name" required />
              <label className="text-xs font-semibold uppercase tracking-[.1em] text-[#6b7671]">
                Legal form
                <select name="legalForm" className="form-control mt-2">
                  <option>GmbH</option>
                  <option>AG</option>
                  <option>GmbH & Co. KG</option>
                  <option>KG</option>
                </select>
              </label>
              <Field label="City" name="city" required />
              <Field label="State" name="state" />
              <Field label="Postcode" name="postcode" />
              <Field label="WZ2025 code" name="industryCode" />
              <Field label="Industry" name="industry" />
              <Field label="Website" name="website" type="url" />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 rounded-lg border border-[#d7d4cc] bg-white px-4 text-xs font-semibold"
              >
                Cancel
              </button>
              <button disabled={saving} className="h-10 rounded-lg bg-[#13201d] px-4 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? "Saving…" : "Add target"}
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
