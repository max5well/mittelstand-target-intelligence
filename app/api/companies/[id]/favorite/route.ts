import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeWorkspaceRequest } from "@/lib/auth/api";
import { createAdminClient } from "@/lib/db/admin";

const CompanyIdSchema = z.string().uuid();

type FavoriteRouteContext = { params: Promise<{ id: string }> };
type WorkspaceAuthorization = Extract<
  Awaited<ReturnType<typeof authorizeWorkspaceRequest>>,
  { ok: true }
>;
type AuthorizedCompany =
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      authorization: WorkspaceAuthorization;
      companyId: string;
      supabase: ReturnType<typeof createAdminClient>;
    };

async function authorizeCompany(
  request: Request,
  context: FavoriteRouteContext,
): Promise<AuthorizedCompany> {
  const authorization = await authorizeWorkspaceRequest(request, {
    write: true,
  });
  if (!authorization.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: authorization.error },
        { status: authorization.status },
      ),
    };
  }

  const parsedCompanyId = CompanyIdSchema.safeParse((await context.params).id);
  if (!parsedCompanyId.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Ungültige Unternehmens-ID" },
        { status: 400 },
      ),
    };
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (!process.env.SUPABASE_SECRET_KEY &&
      !process.env.SUPABASE_SERVER_ACCESS_TOKEN)
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Produktionsdatenbank ist nicht konfiguriert" },
        { status: 503 },
      ),
    };
  }

  const supabase = createAdminClient();
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("workspace_id", authorization.workspaceId)
    .eq("id", parsedCompanyId.data)
    .maybeSingle();

  if (companyError) {
    console.error("[api/companies/favorite] company lookup failed", {
      companyId: parsedCompanyId.data,
      error: companyError.message,
    });
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unternehmen konnte nicht geprüft werden" },
        { status: 500 },
      ),
    };
  }
  if (!company) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unternehmen nicht gefunden" },
        { status: 404 },
      ),
    };
  }

  return {
    ok: true,
    authorization,
    companyId: parsedCompanyId.data,
    supabase,
  };
}

export async function PUT(request: Request, context: FavoriteRouteContext) {
  const authorized = await authorizeCompany(request, context);
  if (!authorized.ok) return authorized.response;

  const { error } = await authorized.supabase.from("favorites").upsert(
    {
      workspace_id: authorized.authorization.workspaceId,
      company_id: authorized.companyId,
      user_id: authorized.authorization.userId,
    },
    { onConflict: "company_id,user_id", ignoreDuplicates: true },
  );
  if (error) {
    console.error("[api/companies/favorite] favorite upsert failed", {
      companyId: authorized.companyId,
      error: error.message,
    });
    return NextResponse.json(
      { error: "Favorit konnte nicht gespeichert werden" },
      { status: 500 },
    );
  }

  console.info("[api/companies/favorite] favorite saved", {
    companyId: authorized.companyId,
  });
  return NextResponse.json({ favorite: true });
}

export async function DELETE(request: Request, context: FavoriteRouteContext) {
  const authorized = await authorizeCompany(request, context);
  if (!authorized.ok) return authorized.response;

  const { error } = await authorized.supabase
    .from("favorites")
    .delete()
    .eq("workspace_id", authorized.authorization.workspaceId)
    .eq("company_id", authorized.companyId)
    .eq("user_id", authorized.authorization.userId);
  if (error) {
    console.error("[api/companies/favorite] favorite delete failed", {
      companyId: authorized.companyId,
      error: error.message,
    });
    return NextResponse.json(
      { error: "Favorit konnte nicht entfernt werden" },
      { status: 500 },
    );
  }

  console.info("[api/companies/favorite] favorite removed", {
    companyId: authorized.companyId,
  });
  return NextResponse.json({ favorite: false });
}
