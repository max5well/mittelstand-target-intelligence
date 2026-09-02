"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/db/browser";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState(false);

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
    <div className="mt-7">
      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-[#f8e7e4] p-3 text-xs text-[#91433a]"
        >
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={oauthPending}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#cfcfcf] bg-white px-4 text-sm font-semibold text-[#28312e] shadow-sm transition hover:border-[#aeb7b3] hover:bg-[#fcfcfc] disabled:cursor-wait disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
          <path
            fill="#4285F4"
            d="M21.35 12.2c0-.64-.06-1.26-.16-1.86H12v3.52h5.25a4.49 4.49 0 0 1-1.95 2.94v2.29h3.16c1.85-1.7 2.89-4.22 2.89-6.89Z"
          />
          <path
            fill="#34A853"
            d="M12 21.75c2.64 0 4.85-.88 6.46-2.38l-3.16-2.29c-.88.59-2 .94-3.3.94-2.55 0-4.71-1.72-5.48-4.03H3.26v2.36A9.75 9.75 0 0 0 12 21.75Z"
          />
          <path
            fill="#FBBC05"
            d="M6.52 13.99A5.86 5.86 0 0 1 6.22 12c0-.69.12-1.36.3-1.99V7.65H3.26A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.06 1.01 4.35l3.26-2.36Z"
          />
          <path
            fill="#EA4335"
            d="M12 5.98c1.44 0 2.72.49 3.73 1.46l2.8-2.8C16.84 3.07 14.64 2.25 12 2.25a9.75 9.75 0 0 0-8.74 5.4l3.26 2.36C7.29 7.7 9.45 5.98 12 5.98Z"
          />
        </svg>
        {oauthPending ? "Weiterleitung zu Google…" : "Mit Google anmelden"}
      </button>
    </div>
  );
}
