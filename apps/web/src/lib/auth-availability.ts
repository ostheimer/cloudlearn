import { SUPABASE_SETTINGS_URL, SUPABASE_APIKEY } from "./supabase-browser";

export interface AuthProviderAvailability {
  email: boolean;
  google: boolean;
  apple: boolean;
}

/**
 * Probes the Supabase project settings so the login UI only shows social
 * buttons for providers that are actually enabled. Mirrors the mobile app:
 * Google/Apple stay hidden until configured in the Supabase dashboard.
 */
export async function getAuthProviderAvailability(): Promise<AuthProviderAvailability> {
  try {
    const response = await fetch(SUPABASE_SETTINGS_URL, {
      headers: { apikey: SUPABASE_APIKEY },
    });
    if (!response.ok) throw new Error("settings request failed");

    const payload = (await response.json()) as {
      external?: Record<string, boolean | undefined>;
    };

    return {
      email: payload.external?.email !== false,
      google: payload.external?.google === true,
      apple: payload.external?.apple === true,
    };
  } catch {
    return { email: true, google: false, apple: false };
  }
}
