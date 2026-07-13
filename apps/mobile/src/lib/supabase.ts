import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { SupabaseAuthStorage } from "./authStorage";

// Supabase project credentials (public / anon key — safe to expose in client).
// Configurable via env (staging/preview builds); production values as fallback
// so builds without env configuration keep working (#77).
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  "https://yektpwhycxusblnueplm.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  "sb_publishable_BN5r8pNWC40Eahc8h5NqpA_imO5Ky-f";

export interface AuthProviderAvailability {
  email: boolean;
  google: boolean;
  apple: boolean;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SupabaseAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    flowType: "pkce",
    detectSessionInUrl: Platform.OS === "web",
  },
});

export async function getAuthProviderAvailability(): Promise<AuthProviderAvailability> {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) {
      throw new Error("settings request failed");
    }

    const payload = (await response.json()) as {
      external?: Record<string, boolean | undefined>;
    };

    return {
      email: payload.external?.email !== false,
      google: payload.external?.google === true,
      apple: payload.external?.apple === true,
    };
  } catch {
    return {
      email: true,
      google: false,
      apple: false,
    };
  }
}
