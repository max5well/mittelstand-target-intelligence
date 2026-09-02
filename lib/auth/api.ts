import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isAllowedGoogleUser } from "@/lib/auth/access";
import { getOwnerPreviewIdentity } from "@/lib/auth/preview";

type ApiAuthorization =
  | {
      ok: true;
      userId: string;
      workspaceId: string;
      role: "admin" | "analyst" | "viewer";
    }
  | { ok: false; status: 401 | 403; error: string };

export async function authorizeWorkspaceRequest(
  request: Request,
  options: { write?: boolean } = {},
): Promise<ApiAuthorization> {
  const requestedWorkspaceId = request.headers.get("x-workspace-id");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const ownerIdentity = getOwnerPreviewIdentity(request.headers);
  const localAuthBypass =
    process.env.LOCAL_AUTH_BYPASS === "true" &&
    process.env.NODE_ENV !== "production";
  if (ownerIdentity) {
    return {
      ok: true,
      userId: ownerIdentity.id,
      workspaceId:
        requestedWorkspaceId ?? "00000000-0000-4000-8000-000000000010",
      role: "admin",
    };
  }
  if (
    localAuthBypass ||
    ((!url || !key) && process.env.NODE_ENV !== "production")
  ) {
    return {
      ok: true,
      userId: "00000000-0000-4000-8000-000000000001",
      workspaceId:
        requestedWorkspaceId ?? "00000000-0000-4000-8000-000000000010",
      role: "admin",
    };
  }
  if (!url || !key || !requestedWorkspaceId) {
    return { ok: false, status: 401, error: "Authentication required" };
  }
  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) =>
        items.forEach(({ name, value, options: cookieOptions }) =>
          cookieStore.set(name, value, cookieOptions),
        ),
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, status: 401, error: "Authentication required" };
  if (!isAllowedGoogleUser(user))
    return { ok: false, status: 403, error: "Account access denied" };
  const { data: membership } = await supabase
    .from("workspace_memberships")
    .select("workspace_id,role")
    .eq("workspace_id", requestedWorkspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership)
    return { ok: false, status: 403, error: "Workspace access denied" };
  const role = membership.role as "admin" | "analyst" | "viewer";
  if (options.write && role === "viewer")
    return { ok: false, status: 403, error: "Write access denied" };
  return {
    ok: true,
    userId: user.id,
    workspaceId: membership.workspace_id,
    role,
  };
}
