import { PageHeader } from "@/components/app-shell";
import { AnalyticsCharts } from "@/components/analytics-charts";

export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-[1500px] p-5 md:p-9">
      <PageHeader
        eyebrow="Portfolio intelligence"
        title="Analytics"
        description="Coverage-aware analytics for the current workspace and active saved-search population."
      />
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["New · 30 days", "276", "All saved searches"],
          ["Favorites", "8", "16.7% of 48"],
          ["Median revenue", "€38.4m", "39 reported"],
          ["Median data age", "74 days", "7 stale records"],
          ["Provider credits", "1,284", "Current month"],
        ].map(([label, value, note]) => (
          <div
            key={label}
            className="rounded-xl border border-[#d8d5cc] bg-[#faf9f6] p-4"
          >
            <p className="text-[11px] text-[#75807c]">{label}</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
            <p className="mt-2 text-[10px] text-[#7a8580]">{note}</p>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <AnalyticsCharts />
      </div>
    </div>
  );
}
