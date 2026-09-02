const TITLE_RULES: Array<[RegExp, string]> = [
  [
    /catering.*event[- ]location|event[- ]location.*catering/i,
    "Catering and Event Location",
  ],
  [/konzert|tournee/i, "Konzert- und Tourneeveranstalter"],
  [/gastronomie|brauerei/i, "Gastronomie & Brauerei"],
  [/schreinerei|tischlerei/i, "Schreinereibetrieb"],
  [/physiotherap/i, "Physiotherapiepraxis"],
  [
    /personalberatung|arbeits?nehmerüberlassung|personaldienst/i,
    "Personaldienstleister",
  ],
  [/online.marketing|marketing.agentur/i, "Online-Marketing-Agentur"],
  [/medienagentur|werbeagentur/i, "Medien- und Werbeagentur"],
  [
    /software.*it.beratung|it.beratung.*software/i,
    "Softwareentwicklung & IT-Beratung",
  ],
  [/photovoltaik|\bpv[- ]/i, "Photovoltaik-Anlagenbau"],
  [/micro.*wind|windgenerator/i, "Micro-Windgeneratoren"],
  [/abgastechn|umwelttechnik/i, "Abgas- und Umwelttechnik"],
  [/bedachungsmaterial|dach.*holzhandel/i, "Bedachungsmaterial & Holzhandel"],
  [/öfen|ofenbau|feuerstellen/i, "Ofenbau"],
  [/kfz.*spezialwerkzeug/i, "Kfz-Spezialwerkzeuge"],
  [/autohaus.*camper|camper.*autohaus/i, "Autohaus & Campervermietung"],
  [/reisemobil/i, "Reisemobilhandel"],
  [/bootsverleih|bootsschule/i, "Bootsverleih & Bootsschule"],
  [
    /lebensmittel.*großhandel|großhandel.*lebensmittel/i,
    "Lebensmittelgroßhandel",
  ],
  [
    /fleisch.*großhandel|fleischverarbeitung/i,
    "Fleischverarbeitung & -großhandel",
  ],
  [
    /möbel.*wohnaccessoire|wohnaccessoire.*möbel/i,
    "Möbel & Wohnaccessoires E-Commerce",
  ],
  [
    /refurbish|generalüberholt.*elektronik/i,
    "Refurbished Electronics E-Commerce",
  ],
  [/geländer|handlauf/i, "Geländer- und Handlaufsysteme"],
  [/kunststoff.*spritzguss|spritzguss.*kunststoff/i, "Kunststoffspritzguss"],
  [/metallpulver|\bmim\b/i, "Metallpulver-Spritzguss (MIM)"],
  [/gummiform/i, "Gummiformartikel"],
  [
    /metallverarbeitung.*schweiß|schweiß.*metallverarbeitung/i,
    "Metallverarbeitung & Schweißtechnik",
  ],
  [
    /maschinenbau.*stahlbau|stahlbau.*maschinenbau|maschinen- und stahlbau/i,
    "Maschinen- und Stahlbau",
  ],
  [/industrie.*stahlbau|stahlbau.*industrie/i, "Industrie- und Stahlbau"],
  [/stahl- und metallbau|metall- und stahlbau/i, "Stahl- und Metallbau"],
  [/fahrzeugbau/i, "Fahrzeugbau"],
  [
    /antriebstechnik|antriebs- und lineartechnik/i,
    "Technischer Handel für Antriebstechnik",
  ],
  [/beschichtung/i, "Industrielle Beschichtung"],
  [/haustechnik.*schalt|schaltanlage/i, "Haustechnik & Schaltanlagen"],
  [/haustechnik/i, "Haustechnik-Fachbetrieb"],
  [/sanitär.*gebäude|gebäudetechnik/i, "Sanitär- und Gebäudetechnik"],
  [/\bshk\b/i, "SHK-Fachbetrieb"],
  [/transport|tansport|spedition/i, "Transportunternehmen"],
  [/architekt/i, "Architekturbüro"],
  [/druckerei|druckbetrieb/i, "Druckereibetrieb"],
  [/beton/i, "Beton- und Gestaltungslösungen"],
  [/holz.*furnier|furnier/i, "Holz- und Furnierunternehmen"],
  [
    /entwicklungs.*prüf|prüf.*entwicklung/i,
    "Entwicklungs- und Prüfdienstleistungen",
  ],
  [/werbemittel/i, "Werbemittel"],
  [/dienstleistungsunternehmen der industrie/i, "Industriedienstleister"],
  [
    /softwareentwicklung|softwareentwicklungs/i,
    "Softwareentwicklung & IT-Beratung",
  ],
  [/beleuchtung/i, "Nachhaltige Beleuchtung"],
  [/jagd/i, "Jagdausstatter"],
  [/bauartikel|baustoff/i, "Baustoffgroßhandel"],
];

const MARKETING_PREFIX =
  /^(?:projekt\s+[a-z0-9]+\s*[-–:]\s*)?(?:(?:prämierter?|innovativer?|etablierter?|erfolgreicher?|profitabler?|führender?|attraktiver?|renommierter?|wachstumsstarker?|spezialisierter?|moderner?|zukunftsorientierter?|inhabergeführter?|mittelständischer?)\s+(?:und\s+)?)+/i;

export function summarizeSaleListingTitle(
  originalTitle: string,
  description = "",
) {
  const normalized = cleanText(originalTitle);
  const searchable = `${normalized} ${cleanText(description)}`;
  const matched =
    TITLE_RULES.find(([pattern]) => pattern.test(normalized)) ??
    TITLE_RULES.find(([pattern]) => pattern.test(searchable));
  if (matched) return matched[1];

  const stripped = normalized
    .replace(/^projekt\s+[a-z0-9]+\s*[-–:]\s*/i, "")
    .replace(MARKETING_PREFIX, "")
    .replace(
      /^(?:unternehmen|betrieb)\s+(?:für|im bereich|aus dem bereich)\s+/i,
      "",
    )
    .replace(
      /\s+(?:im rahmen einer nachfolge|steht zum verkauf|zu verkaufen).*$/i,
      "",
    )
    .trim();
  return truncateAtWord(stripped || normalized, 68);
}

export function summarizeSaleListingDescription(
  originalTitle: string,
  description: string,
) {
  const combined = `${originalTitle} ${description}`;
  if (
    /catering.*event[- ]location|event[- ]location.*catering/i.test(combined)
  ) {
    return "Prämierter Veranstalter mit Catering und eigener Event-Location in Deutschland; die Beteiligung wird im Rahmen einer Nachfolge angeboten.";
  }

  const cleanedDescription = cleanText(description)
    .replace(/\s*[•·]\s*/g, "; ")
    .replace(/;+\s*;/g, ";");
  const source = cleanedDescription || cleanText(originalTitle);
  return truncateAtWord(source, 210);
}

export function formatSaleListingLocation(location: string | null) {
  const normalized = cleanText(location ?? "");
  const regionalLabels: Record<string, string> = {
    nord: "Norddeutschland",
    ost: "Ostdeutschland",
    süd: "Süddeutschland",
    sued: "Süddeutschland",
    west: "Westdeutschland",
  };
  return (
    regionalLabels[normalized.toLocaleLowerCase("de")] ??
    (normalized || "Deutschland")
  );
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncateAtWord(value: string, maximum: number) {
  if (value.length <= maximum) return value;
  const shortened = value.slice(0, maximum + 1);
  const boundary = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, boundary > maximum * 0.6 ? boundary : maximum).trim()}…`;
}
