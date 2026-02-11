import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

// Supabase project credentials (public / anon key — safe to expose in client)
const SUPABASE_URL = "https://yektpwhycxusblnueplm.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlla3Rwd2h5Y3h1c2JsbnVlcGxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk0MDg4MDEsImV4cCI6MjA1NDk4NDgwMX0.VvClpxGjsGMR9JWsMjLYaM7K8BFxrAyMQyDhVOxnNx4";

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
    detectSessionInUrl: Platform.OS === "web",
  },
});
