import "server-only";
import { z } from "zod";

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

export async function fetchProvider<T extends z.ZodType>(
  url: string,
  init: RequestInit,
  schema: T,
  attempts = 3,
): Promise<z.output<T>> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url, { ...init, cache: "no-store" });
    if (response.ok) return schema.parse(await response.json());
    const retryAfter = response.headers.get("retry-after");
    const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : undefined;
    if (
      (response.status === 429 || response.status >= 500) &&
      attempt + 1 < attempts
    ) {
      const backoff =
        retryAfterMs ??
        Math.min(8_000, 400 * 2 ** attempt) + Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, backoff));
      continue;
    }
    const providerHost = new URL(url).hostname;
    const paymentHint =
      response.status === 402
        ? " The provider account has no usable credits or billing access."
        : "";
    throw new ProviderError(
      `Provider request to ${providerHost} failed with status ${response.status}.${paymentHint}`,
      response.status,
      retryAfterMs,
    );
  }
  throw new ProviderError("Provider request exhausted retries", 503);
}
