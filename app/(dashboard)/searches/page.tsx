import { PageHeader } from "@/components/app-shell";
import { SearchBuilder, SearchCard } from "@/components/search-builder";

export default function SearchesPage() {
  return (
    <div className="mx-auto max-w-[1500px] p-5 md:p-9">
      <PageHeader
        eyebrow="Discovery engine"
        title="Saved searches"
        description="Translate the investment thesis into repeatable OpenRegister-aligned discovery runs."
        action={<SearchBuilder />}
      />
      <div className="mt-7 grid gap-5 xl:grid-cols-2">
        <SearchCard
          name="German industrial automation"
          active
          summary="Active GmbH/AG, 50–250 employees, €10m–€80m revenue, €2m+ EBITDA, WZ 28/26, owner-managed, no open insolvency."
          lastRun="Today · 06:30"
          accepted={40}
        />
        <SearchCard
          name="Healthcare components"
          active
          summary="Active medical-technology suppliers, 25–200 employees, €5m–€50m revenue, family-owned or founder-owned, Southern Germany."
          lastRun="Today · 07:10"
          accepted={31}
        />
        <SearchCard
          name="Packaging platforms"
          active={false}
          summary="Flexible and rigid packaging manufacturers, €15m–€100m revenue, 80+ employees, all German regions."
          lastRun="24 Aug · 08:00"
          accepted={27}
        />
      </div>
    </div>
  );
}
