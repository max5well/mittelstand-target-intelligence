import { PageHeader } from "@/components/app-shell";
import { GermanyMap } from "@/components/germany-map";
import { companies } from "@/lib/mock-data";

export default function MapPage() {
  return (
    <div className="mx-auto max-w-[1500px] p-5 md:p-9">
      <PageHeader
        eyebrow="Spatial intelligence"
        title="Germany map"
        description="Explore clustered targets by geography while preserving the active company filters."
      />
      <div className="mt-6">
        <GermanyMap companies={companies} />
      </div>
    </div>
  );
}
