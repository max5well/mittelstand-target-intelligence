import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function redirectToLogin(request: Request, reason: "auth_error" | "configuration") {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.url;
  return NextResponse.redirect(
    new URL(`/login?reason=${encodeURIComponent(reason)}`, baseUrl),
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return redirectToLogin(request, "configuration");
  }
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) =>
        items.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        ),
    },
  });
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirectToLogin(request, "auth_error");
    }
  }
  return NextResponse.redirect(new URL("/overview", request.url));
}
