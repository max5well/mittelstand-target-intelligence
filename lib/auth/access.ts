type AuthenticatedUser = {
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
};

export const ALLOWED_EMAILS = [
  "wiese@dge.technology",
  "leonhardt@dge.technology",
] as const;

const allowedEmailSet = new Set<string>(ALLOWED_EMAILS);

export function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

export function isAllowedEmail(email: string | null | undefined) {
  return allowedEmailSet.has(normalizeEmail(email));
}

export function isAllowedGoogleUser(
  user: AuthenticatedUser | null | undefined,
) {
  return (
    isAllowedEmail(user?.email) && user?.app_metadata?.provider === "google"
  );
}
