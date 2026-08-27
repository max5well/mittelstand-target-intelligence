export function nextAttempt(
  attempt: number,
  now = Date.now(),
  random = Math.random(),
) {
  const baseMs = Math.min(
    60 * 60 * 1000,
    1_000 * 2 ** Math.max(0, attempt - 1),
  );
  return new Date(
    now + baseMs + Math.floor(random * Math.min(5_000, baseMs * 0.25)),
  );
}

export function searchRunKey(savedSearchId: string, scheduledDate: string) {
  return `${savedSearchId}:${scheduledDate}`;
}

export function jobIdempotencyKey(parts: {
  workspaceId: string;
  companyId?: string;
  runId?: string;
  type: string;
  freshnessBucket?: string;
}) {
  return [
    parts.workspaceId,
    parts.companyId ?? parts.runId ?? "workspace",
    parts.type,
    parts.freshnessBucket ?? "current",
  ].join(":");
}
