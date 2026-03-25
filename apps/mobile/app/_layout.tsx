import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { initializeI18n } from "../src/i18n";
import { useSessionStore } from "../src/store/sessionStore";
import { supabase } from "../src/lib/supabase";
import { useColors, useResolvedThemeMode } from "../src/theme";
import {
  initializeRevenueCatForUser,
  logoutRevenueCatUser,
} from "../src/features/paywall/revenuecat";
import { useOnboardingState } from "../src/features/onboarding/onboardingState";
import { registerPaywallTrigger, unregisterPaywallTrigger, registerPushToken } from "../src/lib/api";
import { resolveRootRedirect } from "../src/navigation/rootRedirect";

initializeI18n("de");

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, initialize, setSession, userId } =
    useSessionStore();
  const c = useColors();
  const themeMode = useResolvedThemeMode();
  const onboardingCompleted = useOnboardingState((state) => state.completed);
  const loadCompletedFromStorage = useOnboardingState(
    (state) => state.loadCompletedFromStorage
  );
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);

  // Initialize auth state on mount
  useEffect(() => {
    initialize();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Load onboarding completed from storage when user is authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setOnboardingLoaded(false);
      return;
    }
    let cancelled = false;

    loadCompletedFromStorage().finally(() => {
      if (!cancelled) {
        setOnboardingLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, loadCompletedFromStorage]);

  // Redirect based on auth state and onboarding
  useEffect(() => {
    const redirect = resolveRootRedirect({
      isAuthenticated,
      isLoading,
      onboardingLoaded,
      onboardingCompleted,
      firstSegment: segments[0],
    });

    if (redirect) {
      router.replace(redirect);
    }
  }, [
    isAuthenticated,
    isLoading,
    onboardingLoaded,
    onboardingCompleted,
    router,
    segments,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      void logoutRevenueCatUser();
      return;
    }

    void initializeRevenueCatForUser(userId);

    // Register Expo push token with our backend for streak notifications
    (async () => {
      try {
        const { default: Notifications } = await import("expo-notifications");
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== "granted") return;
        const token = await Notifications.getExpoPushTokenAsync();
        if (token.data) {
          const { Platform } = await import("react-native");
          const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
          await registerPushToken(token.data, platform as "ios" | "android" | "web");
        }
      } catch {
        // Push token registration is best-effort
      }
    })();
  }, [isAuthenticated, userId]);

  // Register a global paywall trigger so any API 402 response auto-navigates to paywall
  useEffect(() => {
    registerPaywallTrigger(() => {
      router.push("/paywall");
    });
    return () => {
      unregisterPaywallTrigger();
    };
  }, [router]);

  // React Navigation theme — ensures all navigators (tab bar, headers, etc.)
  // use the same light/dark palette and re-render consistently on theme change.
  const navTheme = themeMode === "dark"
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, primary: c.primary, background: c.background, card: c.surface, text: c.text, border: c.border } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: c.primary, background: c.background, card: c.surface, text: c.text, border: c.border } };

  // Shared header style derived from current theme
  const headerStyle = { backgroundColor: c.background };
  const headerTintColor = c.primary;

  // Loading screen while checking auth or hydrating onboarding state
  if (isLoading || (isAuthenticated && !onboardingLoaded)) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: c.background }}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen
              name="deck/[id]"
              options={{
                headerShown: true,
                headerBackTitle: "Decks",
                headerTintColor,
                headerStyle,
              }}
            />
            <Stack.Screen
              name="quiz"
              options={{
                headerShown: true,
                headerBackTitle: "Zurück",
                headerTintColor,
                headerStyle,
              }}
            />
            <Stack.Screen
              name="match"
              options={{
                headerShown: true,
                headerBackTitle: "Zurück",
                headerTintColor,
                headerStyle,
              }}
            />
            <Stack.Screen
              name="occlusion"
              options={{
                headerShown: true,
                headerBackTitle: "Zurück",
                headerTintColor,
                headerStyle,
              }}
            />
            <Stack.Screen
              name="paywall"
              options={{
                headerShown: true,
                headerBackTitle: "Zurück",
                headerTintColor,
                headerStyle,
                title: "Upgrade",
              }}
            />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
