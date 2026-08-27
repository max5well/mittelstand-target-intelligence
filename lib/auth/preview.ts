import "server-only";

/**
 * Allows the Sites owner-only deployment to use fictional data without a
 * Supabase project. Never enable this on a public or shared deployment.
 */
export function isOwnerOnlyPreviewMode(): boolean {
  return process.env.OWNER_ONLY_PREVIEW_MODE === "true";
}

export function getOwnerPreviewIdentity(requestHeaders: Headers): {
  id: string;
  email: string;
} | null {
  if (!isOwnerOnlyPreviewMode()) return null;
  const id = requestHeaders.get("oai-authenticated-user-id")?.trim();
  const email = requestHeaders.get("oai-authenticated-user-email")?.trim();
  if (!id || !email) return null;
  return { id, email };
}
