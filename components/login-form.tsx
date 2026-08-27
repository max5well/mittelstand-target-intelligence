"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/db/browser";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      if (process.env.NODE_ENV !== "production") {
        router.push("/overview");
        return;
      }
      setError("Authentication is not configured.");
      setPending(false);
      return;
    }
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    });
    if (authError) {
      setError("Sign-in failed. Check your credentials or invitation status.");
      setPending(false);
      return;
    }
    router.push("/overview");
    router.refresh();
  }
  return (
    <form action={submit} className="mt-6 space-y-4">
      <label className="block text-xs font-semibold uppercase tracking-[.1em] text-[#67726e]">
        Email
        <input
          name="email"
          className="form-control mt-2"
          type="email"
          required
          placeholder="you@firm.com"
        />
      </label>
      <label className="block text-xs font-semibold uppercase tracking-[.1em] text-[#67726e]">
        Password
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
        disabled={pending}
        className="h-11 w-full rounded-lg bg-[#13201d] text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
