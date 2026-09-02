export function formatMoney(cents: number | null, compact = true) {
  if (cents === null) return "N/V";
  const euros = cents / 100;
  if (compact) {
    const absolute = Math.abs(euros);
    if (absolute >= 1_000_000_000)
      return `${formatCompactNumber(euros / 1_000_000_000)} Mrd. €`;
    if (absolute >= 1_000_000)
      return `${formatCompactNumber(euros / 1_000_000)} Mio. €`;
    if (absolute >= 1_000)
      return `${formatCompactNumber(euros / 1_000)} Tsd. €`;
  }
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: compact ? 0 : 2,
  }).format(euros);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number | null) {
  if (value === null) return "N/V";
  return new Intl.NumberFormat("de-DE", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "Neu",
    reviewed: "Geprüft",
    shortlisted: "Auswahlliste",
    contacted: "Kontaktiert",
    in_conversation: "Im Gespräch",
    nda: "NDA",
    diligence: "Due Diligence",
    passed: "Abgelehnt",
    acquired: "Übernommen",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export function ownershipLabel(value: string) {
  const labels: Record<string, string> = {
    Unknown: "Unbekannt",
    "Owner-managed": "Inhabergeführt",
    "Family-owned": "Familiengeführt",
    "Founder-owned": "Gründergeführt",
    "PE-backed": "PE-finanziert",
    Corporate: "Konzern",
    Holding: "Holding",
  };
  return labels[value] ?? value;
}

export function jobTypeLabel(value: string) {
  const labels: Record<string, string> = {
    search: "Suche",
    details: "Unternehmensdetails",
    financials: "Finanzdaten",
    owners: "Eigentümer",
    website_discovery: "Website finden & verifizieren",
    apollo_organization: "Apollo-Unternehmensanreicherung",
    firecrawl_website: "Website-Analyse",
    tavily_research: "Web- & Nachrichtenrecherche",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export function jobStatusLabel(value: string) {
  const labels: Record<string, string> = {
    running: "Läuft",
    succeeded: "Erfolgreich",
    failed: "Fehlgeschlagen",
    retry_wait: "Wartet auf Wiederholung",
    queued: "In Warteschlange",
    cancelled: "Abgebrochen",
    dead_letter: "Endgültig fehlgeschlagen",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}
