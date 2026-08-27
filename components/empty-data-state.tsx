import { Cable, DatabaseZap } from "lucide-react";
import Link from "next/link";

export function EmptyDataState({
  title = "No live company data yet",
  description = "Connect the production database and verify at least one provider before running discovery.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-[#d8d5cc] bg-[#faf9f6] px-6 py-14 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-[#e2eee9] text-[#176f5b]"><DatabaseZap size={21} /></span>
      <h2 className="mt-5 text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#68736e]">{description}</p>
      <Link href="/settings?section=integrations" className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-[#13201d] px-4 text-sm font-semibold text-white"><Cable size={15} /> Review integrations</Link>
    </section>
  );
}
