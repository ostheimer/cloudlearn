import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

// Supabase project credentials (public / anon key — safe to expose in client)
const SUPABASE_URL = "https://yektpwhycxusblnueplm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BN5r8pNWC40Eahc8h5NqpA_imO5Ky-f";

export interface AuthProviderAvailability {
  email: boolean;
  google: boolean;
  apple: boolean;
}

// Custom storage adapter for React Native
const ExpoSecureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Silently fail on storage errors
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Silently fail on storage errors
    }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStorage,
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
