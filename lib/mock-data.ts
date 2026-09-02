import type { Company, Job, OwnershipCategory, PipelineStatus } from "./types";

const names = [
  "Hanseatic Präzisionstechnik",
  "Rheinwerk Automationssysteme",
  "Bergmann Medizintechnik",
  "Nordlicht Gebäudetechnik",
  "Mainbogen Verpackungstechnik",
  "Alpenkraft Dosiersysteme",
  "Elbtal Sensorik",
  "Schwarzwald Oberflächentechnik",
  "Westfalen Antriebstechnik",
  "Isar Prozesswärme",
  "Havel Industrielogistik",
  "Taunus Labortechnik",
  "Franken Kabelsysteme",
  "Ostsee Hygienetechnik",
  "Neckar Präzisionsfedern",
  "Ruhrtal Filteranlagen",
  "Allgäu Kältetechnik",
  "Leine Steuerungstechnik",
  "Mosel Pharma Packaging",
  "Harz Werkzeugbau",
  "Spreewald Umwelttechnik",
  "Saarland Industriemontage",
  "Donau Prüfautomation",
  "Emsland Fördertechnik",
  "Bodensee Vakuumsysteme",
  "Erzgebirge Mikrotechnik",
  "Lippe Kunststofftechnik",
  "Weser Reinraumtechnik",
  "Ortenau Robotik",
  "Uckermark Energiesysteme",
  "Fulda Fluidtechnik",
  "Münsterland Diagnostik",
  "Lausitz Bahntechnik",
  "Chiemgau Messtechnik",
  "Bergstraße Komponenten",
  "Holstein Marine Systems",
  "Pfalz Industrielacke",
  "Thüringen Optoelektronik",
  "Breisgau Anlagenservice",
  "Niederrhein Dichtungstechnik",
  "Hohenlohe Automation",
  "Oberpfalz Lasertechnik",
  "Lüneburger Verpackungen",
  "Rottal Prozesstechnik",
  "Mittelrhein Sicherheitstechnik",
  "Vogtland Präzisionsguss",
  "Kurpfalz Industrietechnik",
  "Oderbruch Wassertechnik",
];

const locations = [
  ["Hamburg", "Hamburg", "20095", 53.55, 9.99],
  ["Düsseldorf", "Nordrhein-Westfalen", "40213", 51.23, 6.77],
  ["Tuttlingen", "Baden-Württemberg", "78532", 47.98, 8.82],
  ["Bremen", "Bremen", "28195", 53.08, 8.81],
  ["Frankfurt", "Hessen", "60311", 50.11, 8.68],
  ["München", "Bayern", "80331", 48.14, 11.58],
  ["Dresden", "Sachsen", "01067", 51.05, 13.74],
  ["Hannover", "Niedersachsen", "30159", 52.37, 9.74],
  ["Berlin", "Berlin", "10115", 52.52, 13.4],
  ["Kiel", "Schleswig-Holstein", "24103", 54.32, 10.14],
  ["Mainz", "Rheinland-Pfalz", "55116", 50.0, 8.27],
  ["Saarbrücken", "Saarland", "66111", 49.24, 7.0],
  ["Magdeburg", "Sachsen-Anhalt", "39104", 52.13, 11.63],
  ["Erfurt", "Thüringen", "99084", 50.98, 11.03],
  ["Potsdam", "Brandenburg", "14467", 52.4, 13.06],
  ["Schwerin", "Mecklenburg-Vorpommern", "19053", 53.63, 11.41],
] as const;

const industries = [
  ["28.29.0", "Machinery & equipment"],
  ["26.51.0", "Measurement instruments"],
  ["32.50.1", "Medical technology"],
  ["27.12.0", "Electrical control systems"],
  ["22.22.0", "Plastic packaging"],
  ["25.62.0", "Precision machining"],
] as const;

const ownerships: OwnershipCategory[] = [
  "Family-owned",
  "Owner-managed",
  "Founder/individual-owned",
  "Holding-company-owned",
  "Corporate/strategic-owned",
  "PE-backed or financial-sponsor-owned",
];

const statuses: PipelineStatus[] = [
  "new",
  "new",
  "reviewed",
  "shortlisted",
  "reviewed",
  "contacted",
  "in_conversation",
  "diligence",
  "passed",
  "new",
  "shortlisted",
  "nda",
];

export const companies: Company[] = names.map((baseName, index) => {
  const location = locations[index % locations.length];
  const industry = industries[index % industries.length];
  const missingFinancials = index % 9 === 0;
  const ambiguousGeocode = index === 28;
  const revenueCents = missingFinancials
    ? null
    : 1_460_000_000 + index * 137_000_000;
  const ebitdaCents =
    revenueCents === null
      ? null
      : Math.round(revenueCents * (0.09 + (index % 8) * 0.017));
  const employees = index % 11 === 0 ? null : 48 + ((index * 29) % 310);
  const ownership = ownerships[index % ownerships.length];
  return {
    id: `company-${String(index + 1).padStart(3, "0")}`,
    openregisterCompanyId: `or_mock_${String(18001 + index)}`,
    registerReference: `HRB${String(18001 + index)}`,
    registerCourt: `Amtsgericht ${location[0]}`,
    name: `${baseName} ${index % 4 === 1 ? "AG" : "GmbH"}`,
    legalForm: index % 4 === 1 ? "AG" : "GmbH",
    address: `Industriestraße ${index + 1}`,
    city: location[0],
    state: location[1],
    postcode: location[2],
    industryCode: industry[0],
    industry: industry[1],
    website:
      index % 13 === 0
        ? null
        : `https://www.${baseName.toLowerCase().replaceAll(" ", "-").replaceAll("ä", "ae").replaceAll("ö", "oe").replaceAll("ü", "ue")}.example`,
    employees,
    employeeYear: employees === null ? null : 2024 - (index % 3),
    apolloEmployees:
      employees === null ? 73 + index : employees + (index % 2 === 0 ? 14 : -9),
    revenueCents,
    ebitdaCents,
    ebitCents: ebitdaCents === null ? null : Math.round(ebitdaCents * 0.82),
    equityCents: revenueCents === null ? null : Math.round(revenueCents * 0.34),
    debtCents: revenueCents === null ? null : Math.round(revenueCents * 0.18),
    totalAssetsCents:
      revenueCents === null ? null : Math.round(revenueCents * 0.76),
    fiscalYear: revenueCents === null ? null : 2024 - (index % 3),
    financialRetrievedAt:
      revenueCents === null ? null : "2026-08-27T08:00:00.000Z",
    ownership,
    ownershipConfidence: ownership.includes("PE-backed") ? 0.72 : 0.88,
    ownershipMethod: ownership.includes("PE-backed")
      ? "ai_with_evidence"
      : index % 7 === 0
        ? "manual"
        : "rules",
    ownerSummary: ownership.includes("Family")
      ? "Schneider family (72%), management (28%)"
      : ownership.includes("PE-backed")
        ? "Industria Capital II via holding vehicle"
        : `${baseName.split(" ")[0]} Beteiligungs GmbH (100%)`,
    owners: [
      {
        name: ownership.includes("Family")
          ? "Schneider family"
          : `${baseName.split(" ")[0]} Beteiligungs GmbH`,
        type: ownership.includes("Family") ? "natural_person" : "legal_person",
        percentage: 1,
      },
    ],
    ownershipRetrievedAt: "2026-08-27T08:00:00.000Z",
    management: [{ name: "Anna Beispiel", role: "DIRECTOR" }],
    purpose: `Manufacturing and distribution in ${industry[1].toLocaleLowerCase("de")}.`,
    incorporationDate: "1998-01-01",
    capitalCents: 2_500_000,
    status: statuses[index % statuses.length],
    score:
      missingFinancials && index % 2 === 0 ? null : 58 + ((index * 7) % 38),
    favorite: index % 6 === 0,
    hydration:
      index % 5 === 0
        ? ["discovered", "profiled"]
        : [
            "discovered",
            "profiled",
            "financials_complete",
            "ownership_complete",
          ],
    latitude: ambiguousGeocode ? null : location[3] + ((index % 3) - 1) * 0.05,
    longitude: ambiguousGeocode ? null : location[4] + ((index % 4) - 2) * 0.04,
    updatedAt: new Date(Date.UTC(2026, 7, 27 - (index % 45))).toISOString(),
    sourceType: "reported",
    fictional: true,
  };
});

export const jobs: Job[] = [
  {
    id: "job-1",
    company: "Daily Industrials Search",
    provider: "OpenRegister",
    type: "Advanced discovery",
    status: "running",
    credits: 30,
    duration: "1m 42s",
    updatedAt: "Just now",
  },
  {
    id: "job-2",
    company: companies[2].name,
    provider: "OpenRegister",
    type: "Financials",
    status: "succeeded",
    credits: 10,
    duration: "2.1s",
    updatedAt: "4 min ago",
  },
  {
    id: "job-3",
    company: companies[5].name,
    provider: "Firecrawl",
    type: "Website analysis",
    status: "retry_wait",
    credits: 1,
    duration: "8.4s",
    updatedAt: "12 min ago",
    error: "Provider returned 429; retry in 48s",
  },
  {
    id: "job-4",
    company: companies[8].name,
    provider: "OpenRegister",
    type: "Ownership",
    status: "failed",
    credits: 0,
    duration: "1.3s",
    updatedAt: "31 min ago",
    error: "Ownership endpoint unavailable for this legal form",
  },
  {
    id: "job-5",
    company: companies[12].name,
    provider: "Apollo",
    type: "Organization match",
    status: "succeeded",
    credits: 1,
    duration: "3.2s",
    updatedAt: "1h ago",
  },
];

export const fictionalNotice =
  "Demonstration data — all companies and people are fictional.";

export function getCompany(id: string) {
  return companies.find((company) => company.id === id);
}
