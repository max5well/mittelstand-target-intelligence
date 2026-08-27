export function formatMoney(cents: number | null, compact = true) {
  if (cents === null) return "—";
  return new Intl.NumberFormat("en-DE", {
    style: "currency",
    currency: "EUR",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(cents / 100);
}

export function formatPercent(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-DE", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function statusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
