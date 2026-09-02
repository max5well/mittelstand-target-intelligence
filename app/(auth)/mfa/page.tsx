import { KeyRound } from "lucide-react";
import { MfaFlow } from "@/components/mfa-flow";

export default function MfaPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#15352e] p-5">
      <section className="w-full max-w-[400px] rounded-2xl bg-[#f8f6f0] p-7">
        <span className="grid size-10 place-items-center rounded-xl bg-[#dcebe5] text-[#176f5b]">
          <KeyRound size={18} />
        </span>
        <h1 className="mt-5 text-2xl font-semibold">
          Zweiten Faktor bestätigen
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#66716d]">
          Administratoren müssen die TOTP-Prüfung abschließen, bevor sie den
          Arbeitsbereich öffnen können.
        </p>
        <MfaFlow />
      </section>
    </main>
  );
}
