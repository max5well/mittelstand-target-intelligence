import { z } from "zod";

const PRIVATE_IPV4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(?:1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
];

function isPrivateIpv4(host: string) {
  if (PRIVATE_IPV4.some((pattern) => pattern.test(host))) return true;
  const octets = host.split(".").map(Number);
  return (
    octets.length === 4 &&
    octets.every(
      (octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255,
    ) &&
    octets[0] === 100 &&
    octets[1] >= 64 &&
    octets[1] <= 127
  );
}

function mappedIpv4(host: string) {
  const dotted = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (dotted?.[1]) return dotted[1];

  // URL canonicalizes dotted IPv4-mapped IPv6 addresses into two hex groups,
  // for example ::ffff:127.0.0.1 becomes ::ffff:7f00:1.
  const hexadecimal = host.match(/^::ffff:([\da-f]{1,4}):([\da-f]{1,4})$/i);
  if (!hexadecimal?.[1] || !hexadecimal[2]) return null;
  const high = Number.parseInt(hexadecimal[1], 16);
  const low = Number.parseInt(hexadecimal[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join(".");
}

export function isPublicIpAddress(address: string) {
  const host = address.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = mappedIpv4(host);
  if (mapped) return !isPrivateIpv4(mapped);
  if (!host.includes(":")) return !isPrivateIpv4(host);
  return !(
    host === "::" ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    /^fe[89ab][\da-f]:/i.test(host)
  );
}

export function isPublicHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const mapped = mappedIpv4(host);
    if (
      !host ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host === "::" ||
      host === "::1" ||
      !isPublicIpAddress(host) ||
      (mapped !== null && isPrivateIpv4(mapped))
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
