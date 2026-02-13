import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { initializeI18n } from "../src/i18n";
import { useSessionStore } from "../src/store/sessionStore";
import { supabase } from "../src/lib/supabase";
import { useColors, useResolvedThemeMode } from "../src/theme";
import {
  initializeRevenueCatForUser,
  logoutRevenueCatUser,
} from "../src/features/paywall/revenuecat";

initializeI18n("de");

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, initialize, setSession, userId } =
    useSessionStore();
  const c = useColors();
  const themeMode = useResolvedThemeMode();

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

  // Redirect based on auth state
  useEffect(() => {
    if (isLoading) return;

    const inAuthScreen = segments[0] === "auth";

    if (!isAuthenticated && !inAuthScreen) {
      // Not logged in → show auth screen
      router.replace("/auth");
    } else if (isAuthenticated && inAuthScreen) {
      // Logged in but still on auth screen → go to tabs
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments]);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      void logoutRevenueCatUser();
      return;
    }

    void initializeRevenueCatForUser(userId);
  }, [isAuthenticated, userId]);

  // React Navigation theme — ensures all navigators (tab bar, headers, etc.)
  // use the same light/dark palette and re-render consistently on theme change.
  const navTheme = themeMode === "dark"
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, primary: c.primary, background: c.background, card: c.surface, text: c.text, border: c.border } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: c.primary, background: c.background, card: c.surface, text: c.text, border: c.border } };

  // Shared header style derived from current theme
  const headerStyle = { backgroundColor: c.background };
  const headerTintColor = c.primary;

  // Loading screen while checking auth
  if (isLoading) {
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
