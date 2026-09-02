import { describe, expect, it } from "vitest";
import {
  fetchGermanCovenditListings,
  parseCovenditDetailPage,
  parseCovenditListingsPage,
} from "@/lib/integrations/covendit";
import {
  fetchGermanGroenigListings,
  parseGroenigDetailPage,
  parseGroenigListingsPage,
} from "@/lib/integrations/groenig";
import { parsePublicGermanEuro } from "@/lib/integrations/public-sale-listing-utils";

const liveTest =
  process.env.RUN_LIVE_SALE_LISTING_TESTS === "true" ? it : it.skip;

it.each([
  ["4.06 Mio. €", 406_000_000],
  ["2,84 Mio. €", 284_000_000],
  ["450.000 €", 45_000_000],
])("parses public marketplace amount %s", (value, expected) => {
  expect(parsePublicGermanEuro(value)).toBe(expected);
});

liveTest("parses the current public COVENDIT marketplace", async () => {
  const result = await fetchGermanCovenditListings();
  expect(result.listings.length).toBeGreaterThanOrEqual(15);
  expect(result.pagesFetched).toBeGreaterThan(1);
  expect(result.excludedNonGerman).toBeGreaterThanOrEqual(1);
  expect(result.listings.every((listing) => listing.countryCode === "DE")).toBe(
    true,
  );
  expect(
    result.listings.find((listing) => listing.listingId === "C340"),
  ).toEqual(
    expect.objectContaining({
      location: "Berlin",
      employees: 26,
      revenueCents: 284_000_000,
    }),
  );
});

liveTest("parses the current public Grönig marketplace", async () => {
  const result = await fetchGermanGroenigListings();
  expect(result.listings.length).toBeGreaterThan(0);
  expect(result.listings.every((listing) => listing.countryCode === "DE")).toBe(
    true,
  );
  expect(
    result.listings.find((listing) => listing.listingId === "62021"),
  ).toEqual(
    expect.objectContaining({
      location: "Sachsen",
      employees: 9,
      askingPriceCents: 163_000_000,
    }),
  );
});

describe("COVENDIT sale listing parser", () => {
  const listHtml = `
    <li class="l-row__item m-menu-projects__item -stretch-content">
      <div class="m-menu-projects__categories">
        <span>Bau &amp; Handwerk • </span><span class="last">Unternehmensverkauf</span>
      </div>
      <p class="m-menu-projects__headline">C340 - Metallbaubetrieb mit B2B-Kerngeschäft</p>
      <a href="/aktuelle-projekte/metallbau/" class="e-button-primary m-menu-projects__button">mehr erfahren</a>
    </li>`;

  it("extracts stable IDs, agent links, and industry labels", () => {
    expect(parseCovenditListingsPage(listHtml)).toEqual([
      expect.objectContaining({
        listingId: "C340",
        title: "Metallbaubetrieb mit B2B-Kerngeschäft",
        industry: "Bau & Handwerk",
        sourceUrl: "https://covendit.de/aktuelle-projekte/metallbau/",
      }),
    ]);
  });

  it("enriches a German detail page and rejects explicit foreign locations", () => {
    const [card] = parseCovenditListingsPage(listHtml);
    expect(card).toBeDefined();
    const detail = `
      <div class="m-hero-content__bodytext" data-rte><ul>
        <li><strong>Firmensitz:</strong> Berlin</li>
        <li><strong>Branche:</strong> Handwerk</li>
        <li><strong>Mitarbeiter:</strong> 26</li>
        <li><strong>Gesamtleistung:</strong> ~2,84 Mio. €</li>
        <li><strong>EBIT:</strong> ~634 Tsd. €</li>
      </ul></div>
      <div class="e-text-rich " data-rte><p>Das Unternehmen ist ein etablierter Fachbetrieb für anspruchsvolle Stahl- und Metallbaukonstruktionen im öffentlichen Sektor.</p></div>`;
    expect(parseCovenditDetailPage(detail, card!)).toMatchObject({
      countryCode: "DE",
      location: "Berlin",
      employees: 26,
      revenueCents: 284_000_000,
      ebitCents: 63_400_000,
    });
    expect(
      parseCovenditDetailPage(
        detail.replace("Berlin", "Zürich, Schweiz"),
        card!,
      ),
    ).toBeNull();
    expect(
      parseCovenditDetailPage(detail.replace("Berlin", "Österreich"), card!),
    ).toBeNull();
  });
});

describe("UnternehmensBörse Grönig sale listing parser", () => {
  const listHtml = `
    <div class="offer-item sortable">
      <a class="fce-cols clearfix" href="/marktplatz/verkaufsangebote/verkaufsangebot/62021-e-commerce-sachsen">
        <span class="col6">E-Commerce Plattform für Druckerzubehör</span>
        <span class="col3">Sachsen</span>
        <span class="col3">von 3 bis 10 Mio.</span>
      </a>
    </div>`;

  it("extracts German marketplace rows", () => {
    expect(parseGroenigListingsPage(listHtml)).toEqual([
      expect.objectContaining({
        listingId: "62021",
        location: "Sachsen",
        sourceUrl:
          "https://www.unternehmensboerse-abos.de/marktplatz/verkaufsangebote/verkaufsangebot/62021-e-commerce-sachsen",
      }),
    ]);
  });

  it("uses the public exposé for descriptions and the latest financial year", () => {
    const [card] = parseGroenigListingsPage(listHtml);
    expect(card).toBeDefined();
    const block = (label: string, value: string) => `
      <div class="labelblock fce-cols clearfix">
        <div class="label col4">${label}</div>
        <div class="labelblock-content col8">${value}</div>
      </div>`;
    const detail = [
      block("Branche", "Onlinehandel"),
      block("Standort", "Sachsen"),
      block(
        "Geschäftsaktivitäten",
        "<p>Online-Verkauf von Druckern und Druckerzubehör.</p>",
      ),
      block("Personal", "<p>9 Mitarbeiter inkl. Geschäftsführung</p>"),
      block(
        "Unternehmenszahlen",
        "<p>Umsatz 2021 9,1 Mio. € 2022 6,5 Mio. €<br>EBIT 2021 232 T€ 2022 240 T€</p>",
      ),
      block("Verkaufskonditionen", "Unternehmenswert 1,63 Mio. €"),
    ].join("");
    expect(parseGroenigDetailPage(detail, card!)).toMatchObject({
      industry: "Onlinehandel",
      description: "Online-Verkauf von Druckern und Druckerzubehör.",
      employees: 9,
      revenueCents: 650_000_000,
      ebitCents: 24_000_000,
      askingPriceCents: 163_000_000,
    });
  });
});
