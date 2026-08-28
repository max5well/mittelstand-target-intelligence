"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createBrowserSupabaseClient } from "@/lib/db/browser";

export function MfaFlow() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    void supabase.auth.mfa.listFactors().then(async ({ data }) => {
      const verified = data?.totp.find(
        (factor) => factor.status === "verified",
      );
      if (verified) {
        setFactorId(verified.id);
        return;
      }
      const { data: enrolled, error: enrollError } =
        await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Zielunternehmen admin TOTP",
        });
      if (enrollError) {
        setError("TOTP konnte nicht eingerichtet werden.");
        return;
      }
      setFactorId(enrolled.id);
      setQr(enrolled.totp.qr_code);
    });
  }, []);
  async function verify(formData: FormData) {
    const supabase = createBrowserSupabaseClient();
    if (!supabase || !factorId) {
      setError("MFA ist noch nicht bereit.");
      return;
    }
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setError("Die Überprüfung konnte nicht gestartet werden.");
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: String(formData.get("code")),
    });
    if (verifyError) {
      setError("Der Code wurde nicht akzeptiert.");
      return;
    }
    router.push("/overview");
    router.refresh();
  }
  return (
    <form action={verify} className="mt-6">
      {qr && (
        <div className="mb-5 rounded-lg border border-[#d8d5cd] bg-white p-3 text-center">
          <Image
            src={qr}
            alt="Diesen TOTP-QR-Code mit der Authenticator-App scannen"
            width={176}
            height={176}
            unoptimized
            className="mx-auto size-44"
          />
          <p className="mt-2 text-xs text-[#69736f]">
            Einmal scannen und anschließend den aktuellen Code eingeben.
          </p>
        </div>
      )}
      <label className="text-xs font-semibold uppercase tracking-[.1em] text-[#66716d]">
        6-stelliger Code
        <input
          name="code"
          className="form-control mt-2 text-center text-lg tracking-[.35em]"
          inputMode="numeric"
          maxLength={6}
          pattern="[0-9]{6}"
          placeholder="000000"
          required
        />
      </label>
      {error && (
        <p role="alert" className="mt-3 text-xs text-[#91433a]">
          {error}
        </p>
      )}
      <button
        disabled={!factorId}
        className="mt-4 h-11 w-full rounded-lg bg-[#15352e] text-sm font-semibold text-white disabled:opacity-50"
      >
        Code bestätigen
      </button>
    </form>
  );
}
