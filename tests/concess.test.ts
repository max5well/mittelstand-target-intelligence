import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  isGermanConcessListing,
  isPathAllowedByRobots,
  parseConcessListingsPage,
  parseGermanCompactEuro,
} from "@/lib/integrations/concess";

const offer = (input: {
  id: string;
  title: string;
  description: string;
  tags: string[];
  values: Array<[string, string]>;
}) => `
  <article class="cc-row" id="eintrag-${input.id}">
    <div class="cc-row__title">${input.id}<!-- --> – <!-- -->${input.title}</div>
    <p class="cc-row__teaser">${input.description}</p>
    <div class="cc-row__tags">
      ${input.tags.map((tag) => `<span class="cc-row__tag">${tag}</span>`).join("")}
    </div>
    <div class="cc-databox">
      ${input.values
        .map(
          ([key, value]) => `
            <div class="cc-databox__row">
              <div class="cc-databox__ic"></div>
              <div><div class="cc-databox__k">${key}</div><div class="cc-databox__v">${value}</div></div>
            </div>`,
        )
        .join("")}
    </div>
  </article>`;

describe("con|cess sale listing parser", () => {
  it("parses the saved source-page fixture", () => {
    const html = readFileSync(
      new URL("./fixtures/concess-listing-page.html", import.meta.url),
      "utf8",
    );
    expect(parseConcessListingsPage(html, 1)).toEqual([
      expect.objectContaining({
        listingId: "D115V20234",
        title: "Projekt LIGNUM & Partner",
        revenueCents: 97_000_000,
      }),
    ]);
  });

  it("extracts German listing metadata and financial values", () => {
    const [listing] = parseConcessListingsPage(
      offer({
        id: "D115V20234",
        title: "Projekt LIGNUM &amp; Partner",
        description: "Etablierter Betrieb in Bayern.",
        tags: ["Baugewerbe", "Mehrheit", "Gegründet 2010"],
        values: [
          ["Standort", "Süd"],
          ["Umsatz", "970 Tsd €"],
          ["EBITDA", "1,25 Mio €"],
          ["Mitarbeiter", "17"],
          ["Preis", "2 Mio €"],
        ],
      }),
      2,
    );

    expect(listing).toMatchObject({
      listingId: "D115V20234",
      title: "Projekt LIGNUM & Partner",
      industry: "Baugewerbe",
      countryCode: "DE",
      location: "Süd",
      revenueCents: 97_000_000,
      ebitdaCents: 125_000_000,
      askingPriceCents: 200_000_000,
      employees: 17,
      foundedYear: 2010,
    });
    expect(listing?.sourceUrl).toContain("?page=2#eintrag-D115V20234");
    expect(listing && isGermanConcessListing(listing)).toBe(true);
  });

  it("recognizes Austrian IDs so Germany-only imports can exclude them", () => {
    const [listing] = parseConcessListingsPage(
      offer({
        id: "A210V20229",
        title: "Verkaufsangebot",
        description: "Betrieb in Süd-Österreich.",
        tags: ["Herstellung von Backwaren"],
        values: [["Preis", "Auf Anfrage"]],
      }),
      1,
    );

    expect(listing?.countryCode).toBe("AT");
    expect(listing && isGermanConcessListing(listing)).toBe(false);
    expect(listing?.askingPriceCents).toBeNull();
  });

  it.each([
    ["2.147,48 Mio €", 214_748_000_000],
    ["320 Tsd €", 32_000_000],
    ["450.000 €", 45_000_000],
    ["Auf Anfrage", null],
  ])("parses %s into euro cents", (value, expected) => {
    expect(parseGermanCompactEuro(value)).toBe(expected);
  });

  it("fails closed when a markup change removes the listing article contract", () => {
    expect(
      parseConcessListingsPage(
        '<section data-listing="D115V20234"><h2>Changed markup</h2></section>',
        1,
      ),
    ).toEqual([]);
  });

  it("honours the most specific matching robots rule", () => {
    const robots = [
      "User-agent: *",
      "Disallow: /unternehmensboerse/",
      "Allow: /unternehmensboerse/angebote/public",
    ].join("\n");
    expect(
      isPathAllowedByRobots(
        robots,
        "Zielunternehmen",
        "/unternehmensboerse/angebote",
      ),
    ).toBe(false);
    expect(
      isPathAllowedByRobots(
        robots,
        "Zielunternehmen",
        "/unternehmensboerse/angebote/public",
      ),
    ).toBe(true);
  });
});
