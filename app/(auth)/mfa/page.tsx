import { KeyRound } from "lucide-react";
import { MfaFlow } from "@/components/mfa-flow";

export default function MfaPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#13201d] p-5">
      <section className="w-full max-w-[400px] rounded-2xl bg-[#f8f7f3] p-7">
        <span className="grid size-10 place-items-center rounded-xl bg-[#dcebe5] text-[#176f5b]">
          <KeyRound size={18} />
        </span>
        <h1 className="mt-5 text-2xl font-semibold">
          Verify your second factor
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#66716d]">
          Administrators must complete TOTP verification before entering the
          workspace.
        </p>
        <MfaFlow />
      </section>
    </main>
  );
}
