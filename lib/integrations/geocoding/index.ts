import "server-only";
import { z } from "zod";

export const GeocodingResultSchema = z.object({
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  matchQuality: z.enum([
    "rooftop",
    "street",
    "postcode",
    "city",
    "ambiguous",
    "failed",
  ]),
  provider: z.string(),
  retrievedAt: z.string(),
});

export interface GeocodingProvider {
  geocode(address: string): Promise<z.output<typeof GeocodingResultSchema>>;
}
export class ConfiguredGeocoder implements GeocodingProvider {
  async geocode(address: string) {
    z.string().min(5).parse(address);
    if (process.env.MOCK_PROVIDERS !== "false")
      return GeocodingResultSchema.parse({
        latitude: 51.1657,
        longitude: 10.4515,
        matchQuality: "postcode",
        provider: "mock-geocoder",
        retrievedAt: new Date().toISOString(),
      });
    throw new Error(
      "Configure a commercial geocoder adapter with GEOCODING_API_KEY before live use",
    );
  }
}
