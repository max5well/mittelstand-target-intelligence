import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serverAccessToken = process.env.SUPABASE_SERVER_ACCESS_TOKEN;
  if (!url || (!supabaseSecret && (!publishableKey || !serverAccessToken)))
    throw new Error("Supabase server credentials are not configured");
  if (supabaseSecret)
    return createClient(url, supabaseSecret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  return createClient(url, publishableKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { "x-app-backend-token": serverAccessToken! },
    },
  });
}
