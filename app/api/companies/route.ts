import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeWorkspaceRequest } from "@/lib/auth/api";
import { createAdminClient } from "@/lib/db/admin";

const ManualCompanySchema = z.object({
  name: z.string().trim().min(2).max(240),
  legalForm: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(160),
  state: z.string().trim().max(160).optional().default(""),
  postcode: z.string().trim().max(16).optional().default(""),
  industryCode: z.string().trim().max(40).optional().default(""),
  industry: z.string().trim().max(240).optional().default(""),
  website: z.union([z.literal(""), z.string().url()]).optional().default(""),
});

export async function POST(request: Request) {
  const authorization = await authorizeWorkspaceRequest(request, { write: true });
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return NextResponse.json({ error: "Production database is not configured" }, { status: 503 });
  const parsed = ManualCompanySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid company" }, { status: 400 });

  const supabase = createAdminClient();
  const externalId = `manual:${crypto.randomUUID()}`;
  const { data: company, error } = await supabase.from("companies").insert({
    workspace_id: authorization.workspaceId,
    openregister_company_id: externalId,
    legal_name: parsed.data.name,
    legal_form: parsed.data.legalForm,
    website_url: parsed.data.website || null,
    raw_provider_payload: { source: "manual", industry_code: parsed.data.industryCode || null, industry_name: parsed.data.industry || null },
  }).select("id").single();
  if (error) return NextResponse.json({ error: "Unable to save the company" }, { status: 500 });
  const { error: locationError } = await supabase.from("company_locations").insert({
    workspace_id: authorization.workspaceId,
    company_id: company.id,
    postcode: parsed.data.postcode || null,
    city: parsed.data.city,
    bundesland: parsed.data.state || null,
    source_provider: "manual",
    retrieved_at: new Date().toISOString(),
  });
  if (locationError) return NextResponse.json({ error: "Company saved, but its location could not be saved" }, { status: 500 });
  return NextResponse.json({ id: company.id }, { status: 201 });
}
