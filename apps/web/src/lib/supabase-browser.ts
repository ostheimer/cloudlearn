import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client for the web app. Uses the public
 * (publishable/anon) key — safe to expose. Mirrors the mobile client
 * (PKCE, auto-refresh) so the same backend session semantics apply.
 *
 * `detectSessionInUrl` lets the /auth/callback page finish OAuth,
 * magic-link and e-mail-confirmation redirects automatically.
 */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://yektpwhycxusblnueplm.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_BN5r8pNWC40Eahc8h5NqpA_imO5Ky-f";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
  return client;
}

export const SUPABASE_SETTINGS_URL = `${SUPABASE_URL}/auth/v1/settings`;
export const SUPABASE_APIKEY = SUPABASE_ANON_KEY;
