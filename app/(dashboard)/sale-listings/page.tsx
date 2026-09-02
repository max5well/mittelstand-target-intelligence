import { PageHeader } from "@/components/app-shell";
import { EmptyDataState } from "@/components/empty-data-state";
import { ImportSaleListingsButton } from "@/components/import-sale-listings-button";
import { SaleListingsTable } from "@/components/sale-listings-table";
import { requireUser } from "@/lib/auth/user";
import { listSaleOpportunities } from "@/lib/data/sale-listings";
import { hasLiveDataBackend } from "@/lib/integrations/status";

export default async function SaleListingsPage() {
  const user = await requireUser();
  const backendConfigured = hasLiveDataBackend();
  const listings = backendConfigured
    ? await listSaleOpportunities(user.workspaceId, user.id)
    : [];

  return (
    <div className="mx-auto max-w-[1800px] p-5 md:p-9">
      <PageHeader
        eyebrow="M&A-Marktplätze"
        title="Verkaufsangebote"
        description="Anonyme deutsche Unternehmensangebote aus externen Verkaufsplattformen – getrennt vom verifizierten Zieluniversum und immer mit direkter Quellenangabe."
        action={
          backendConfigured ? (
            <ImportSaleListingsButton workspaceId={user.workspaceId} />
          ) : undefined
        }
      />
      {listings.length ? (
        <SaleListingsTable
          key={`${listings.length}:${listings[0]?.updatedAt ?? "empty"}`}
          initialListings={listings}
        />
      ) : (
        <EmptyDataState
          title="Noch keine Verkaufsangebote"
          description="Sobald eine Verkaufsplattform synchronisiert wurde, erscheinen hier ausschließlich ihre deutschen Angebote."
        />
      )}
    </div>
  );
}
