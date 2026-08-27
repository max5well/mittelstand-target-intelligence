import { Building2, LockKeyhole } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-[#13201d] p-5">
      <section className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-[#f8f7f3] p-7 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#30c7a1] text-[#13201d]">
            <Building2 size={19} />
          </span>
          <div>
            <p className="text-sm font-semibold">Unternehmen</p>
            <p className="text-[10px] uppercase tracking-[.14em] text-[#75807c]">
              Private target intelligence
            </p>
          </div>
        </div>
        <div className="mt-8">
          <div className="flex items-center gap-2 text-[#16856b]">
            <LockKeyhole size={14} />
            <p className="text-[10px] font-semibold uppercase tracking-[.13em]">
              Invite-only workspace
            </p>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Sign in to continue
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#66716d]">
            Use the email address invited by your workspace administrator.
          </p>
          {reason && (
            <p className="mt-4 rounded-lg border border-[#ead6a5] bg-[#fff5d9] p-3 text-xs text-[#71591f]">
              {reason === "not_invited"
                ? "This account is not an active workspace member."
                : "Authentication is not configured for this environment."}
            </p>
          )}
          <LoginForm />
          <p className="mt-5 text-center text-[10px] leading-4 text-[#87908d]">
            There is no public registration. Contact your administrator for an
            invitation.
          </p>
        </div>
      </section>
    </main>
  );
}
