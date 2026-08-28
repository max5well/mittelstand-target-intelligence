import { LockKeyhole } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { BrandMark } from "@/components/brand-mark";
import { getOwnerPreviewIdentity } from "@/lib/auth/preview";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  if (getOwnerPreviewIdentity(await headers())) redirect("/overview");
  const { reason } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-[#15352e] p-5">
      <section className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-[#f8f6f0] p-7 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-[#15352e] p-1.5 shadow-sm">
            <BrandMark inverse className="size-full" />
          </span>
          <div>
            <p className="text-sm font-semibold">Zielunternehmen</p>
            <p className="text-xs uppercase tracking-[.14em] text-[#75807c]">
              Private Target Intelligence
            </p>
          </div>
        </div>
        <div className="mt-8">
          <div className="flex items-center gap-2 text-[#13745f]">
            <LockKeyhole size={14} />
            <p className="text-xs font-semibold uppercase tracking-[.13em]">
              Arbeitsbereich nur mit Einladung
            </p>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Anmelden, um fortzufahren
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#66716d]">
            Verwenden Sie die E-Mail-Adresse, die von Ihrem Administrator
            eingeladen wurde.
          </p>
          {reason && (
            <p className="mt-4 rounded-lg border border-[#ead6a5] bg-[#fff5d9] p-3 text-xs text-[#71591f]">
              {reason === "not_invited"
                ? "Dieses Konto ist kein aktives Mitglied des Arbeitsbereichs."
                : reason === "auth_error"
                  ? "Google-Anmeldung fehlgeschlagen. Bitte erneut versuchen."
                  : "Die Authentifizierung ist für diese Umgebung nicht eingerichtet."}
            </p>
          )}
          <LoginForm />
          <p className="mt-5 text-center text-xs leading-4 text-[#87908d]">
            Es gibt keine öffentliche Registrierung. Wenden Sie sich für eine
            Einladung an Ihren Administrator.
          </p>
        </div>
      </section>
    </main>
  );
}
