export default function DashboardLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Daten werden geladen"
      className="p-5 md:p-9"
    >
      <div className="h-8 w-64 animate-pulse rounded-lg bg-[#dfe4df]" />
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border border-[#dedbd3] bg-[#faf9f6]"
          />
        ))}
      </div>
    </main>
  );
}
