import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

type SecureStoreModule = typeof import("expo-secure-store");

let secureStorePromise: Promise<SecureStoreModule | null> | null = null;

async function loadSecureStore(): Promise<SecureStoreModule | null> {
  if (Platform.OS === "web") {
    return null;
  }

  secureStorePromise ??= import("expo-secure-store").catch(() => null);
  return secureStorePromise;
}

async function setSecureItem(key: string, value: string): Promise<boolean> {
  const SecureStore = await loadSecureStore();
  if (!SecureStore) {
    return false;
  }

  try {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    return true;
  } catch {
    return false;
  }
}

async function getSecureItem(key: string): Promise<string | null> {
  const SecureStore = await loadSecureStore();
  if (!SecureStore) {
    return null;
  }

  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function removeSecureItem(key: string): Promise<void> {
  const SecureStore = await loadSecureStore();
  if (!SecureStore) {
    return;
  }

  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Removal is best-effort; AsyncStorage fallback is cleared separately.
  }
}

export const SupabaseAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const secureValue = await getSecureItem(key);
    if (secureValue) {
      return secureValue;
    }

    try {
      const legacyValue = await AsyncStorage.getItem(key);
      if (!legacyValue) {
        return null;
      }

      if (await setSecureItem(key, legacyValue)) {
        await AsyncStorage.removeItem(key);
      }

      return legacyValue;
    } catch {
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (await setSecureItem(key, value)) {
      try {
        await AsyncStorage.removeItem(key);
      } catch {
        // Legacy cleanup is best-effort.
      }
      return;
    }

    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Supabase treats storage writes as best-effort on constrained devices.
    }
  },

  removeItem: async (key: string): Promise<void> => {
    await removeSecureItem(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Best-effort.
    }
  },
};
