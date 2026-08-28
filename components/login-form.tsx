"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/db/browser";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      if (process.env.NODE_ENV !== "production") {
        router.push("/overview");
        return;
      }
      setError("Die Authentifizierung ist nicht eingerichtet.");
      setPending(false);
      return;
    }
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    });
    if (authError) {
      setError(
        "Die Anmeldung ist fehlgeschlagen. Prüfen Sie Ihre Zugangsdaten und den Einladungsstatus.",
      );
      setPending(false);
      return;
    }
    router.push("/overview");
    router.refresh();
  }

  async function signInWithGoogle() {
    setOauthPending(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError("Die Authentifizierung ist nicht eingerichtet.");
      setOauthPending(false);
      return;
    }
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (authError) {
      setError(
        "Die Google-Anmeldung konnte nicht gestartet werden. Bitte versuchen Sie es erneut.",
      );
      setOauthPending(false);
      return;
    }
  }

  return (
    <>
      <form action={submit} className="mt-6 space-y-4">
        <label className="block text-xs font-semibold uppercase tracking-[.1em] text-[#67726e]">
          E-Mail
          <input
            name="email"
            className="form-control mt-2"
            type="email"
            required
            placeholder="sie@unternehmen.de"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-[.1em] text-[#67726e]">
          Passwort
          <input
            name="password"
            className="form-control mt-2"
            type="password"
            required
            placeholder="••••••••••••"
          />
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-[#f8e7e4] p-3 text-xs text-[#91433a]"
          >
            {error}
          </p>
        )}
        <button
          disabled={pending || oauthPending}
          className="h-11 w-full rounded-lg bg-[#15352e] text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Anmeldung läuft…" : "Anmelden"}
        </button>
      </form>
      <div className="mt-3">
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={pending || oauthPending}
          className="h-11 w-full rounded-lg border border-[#15352e]/40 bg-white text-sm font-semibold text-[#15352e] disabled:opacity-60"
        >
          {oauthPending ? "Weiterleitung zu Google…" : "Mit Google fortfahren"}
        </button>
      </div>
    </>
  );
}
