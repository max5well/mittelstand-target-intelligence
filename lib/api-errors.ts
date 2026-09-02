import "server-only";

import { randomUUID } from "node:crypto";
import { ProviderError } from "@/lib/integrations/http";

export async function reportApiError(
  error: unknown,
  context: Record<string, unknown>,
  fallbackMessage: string,
) {
  const errorId = randomUUID();
  const payload = {
    level: "error",
    errorId,
    timestamp: new Date().toISOString(),
    ...context,
    error:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : String(error),
  };
  console.error(JSON.stringify(payload));
  if (process.env.ERROR_WEBHOOK_URL) {
    try {
      await fetch(process.env.ERROR_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3_000),
      });
    } catch (monitoringError) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "error-webhook-failed",
          errorId,
          message:
            monitoringError instanceof Error
              ? monitoringError.message
              : String(monitoringError),
        }),
      );
    }
  }
  return {
    error:
      error instanceof ProviderError && error.status === 402
        ? "Provider-Guthaben erschöpft. Bitte die Kontoverbindung prüfen und später erneut versuchen."
        : fallbackMessage,
    errorId,
  };
}
