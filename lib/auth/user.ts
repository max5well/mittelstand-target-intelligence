import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import {
  getOwnerPreviewIdentity,
  isOwnerOnlyPreviewMode,
} from "@/lib/auth/preview";

export type AppUser = {
  id: string;
  email: string;
  role: "admin" | "analyst" | "viewer";
  workspaceId: string;
  mfaVerified: boolean;
};

export async function requireUser(): Promise<AppUser> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const mockMode = process.env.MOCK_PROVIDERS !== "false";
  const ownerPreview = isOwnerOnlyPreviewMode();
  const ownerIdentity = ownerPreview
    ? getOwnerPreviewIdentity(await headers())
    : null;
  if (
    (!url || !key) &&
    ((mockMode && process.env.NODE_ENV !== "production") || ownerIdentity)
  ) {
    return {
      id: ownerIdentity?.id ?? "00000000-0000-4000-8000-000000000001",
      email: ownerIdentity?.email ?? "mock.admin@example.com",
      role: "admin",
      workspaceId: "00000000-0000-4000-8000-000000000010",
      mfaVerified: true,
    };
  }
  if (!url || !key) redirect("/login?reason=configuration");
  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) =>
        items.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        ),
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");
  const { data: membership } = await supabase
    .from("workspace_memberships")
    .select("workspace_id,role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (!membership) redirect("/login?reason=not_invited");
  const { data: assurance } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const role = membership.role as AppUser["role"];
  if (role === "admin" && assurance?.currentLevel !== "aal2") redirect("/mfa");
  return {
    id: user.id,
    email: user.email,
    role,
    workspaceId: membership.workspace_id,
    mfaVerified: assurance?.currentLevel === "aal2",
  };
}
