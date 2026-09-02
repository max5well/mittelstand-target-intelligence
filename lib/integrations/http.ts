import "server-only";
import { z } from "zod";

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs?: number,
    readonly requestCount = 1,
  ) {
    super(message);
  }
}

export type ProviderRequestMetrics = { requestCount: number };

export const PROVIDER_REQUEST_TIMEOUT_MS = 15_000;

export async function fetchProvider<T extends z.ZodType>(
  url: string,
  init: RequestInit,
  schema: T,
  attempts = 3,
  metrics?: ProviderRequestMetrics,
  timeoutMs = PROVIDER_REQUEST_TIMEOUT_MS,
): Promise<z.output<T>> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (metrics) metrics.requestCount = attempt + 1;
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = init.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal,
    });
    if (response.ok) {
      try {
        return schema.parse(await response.json());
      } catch {
        throw new ProviderError(
          `Provider response from ${new URL(url).hostname} did not match the expected schema.`,
          response.status,
          undefined,
          metrics?.requestCount ?? attempt + 1,
        );
      }
    }
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
      metrics?.requestCount ?? attempt + 1,
    );
  }
  throw new ProviderError(
    "Provider request exhausted retries",
    503,
    undefined,
    metrics?.requestCount ?? attempts,
  );
}

/**
 * Rate limits, server failures, provider 402 responses and requests that never
 * received an HTTP response do not consume provider credits. Other HTTP
 * outcomes are conservatively attributed at most once; retry count remains a
 * separate telemetry field and must not multiply the charge.
 */
export function creditsForProviderOutcome(
  estimatedCredits: number,
  error: unknown,
  requestCount = 1,
) {
  if (
    error instanceof ProviderError &&
    (error.status === 402 || error.status === 429 || error.status >= 500)
  )
    return 0;
  if (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  )
    return 0;
  if (error instanceof TypeError) return 0;
  void requestCount;
  return estimatedCredits;
}
