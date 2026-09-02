import type { Instrumentation } from "next";

export function register() {
  console.log(
    JSON.stringify({
      level: "info",
      event: "application-started",
      runtime: process.env.NEXT_RUNTIME ?? "unknown",
    }),
  );
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const payload = {
    level: "error",
    event: "unhandled-request-error",
    timestamp: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    digest:
      error && typeof error === "object" && "digest" in error
        ? String(error.digest)
        : undefined,
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
  };
  console.error(JSON.stringify(payload));
  if (!process.env.ERROR_WEBHOOK_URL) return;
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
        message:
          monitoringError instanceof Error
            ? monitoringError.message
            : String(monitoringError),
      }),
    );
  }
};
