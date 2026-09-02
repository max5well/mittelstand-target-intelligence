import { z } from "zod";

const PRIVATE_IPV4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(?:1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
];

export function isPublicHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      !host ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host === "::" ||
      host === "::1" ||
      (host.includes(":") &&
        (host.startsWith("fc") ||
          host.startsWith("fd") ||
          host.startsWith("fe80:"))) ||
      PRIVATE_IPV4.some((pattern) => pattern.test(host))
    )
      return false;
    return true;
  } catch {
    return false;
  }
}

export const SafePublicHttpUrlSchema = z
  .string()
  .url()
  .refine(
    isPublicHttpUrl,
    "Nur öffentliche HTTP- oder HTTPS-URLs sind erlaubt.",
  );
