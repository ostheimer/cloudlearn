import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initializeI18n } from "../src/i18n";
import { useSessionStore } from "../src/store/sessionStore";
import { supabase } from "../src/lib/supabase";

initializeI18n("de");

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, initialize, setSession } = useSessionStore();

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

  // Loading screen while checking auth
  if (isLoading) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8f9fa" }}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
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
            headerTintColor: "#6366f1",
            headerStyle: { backgroundColor: "#f8f9fa" },
          }}
        />
        <Stack.Screen
          name="quiz"
          options={{
            headerShown: true,
            headerBackTitle: "Zurück",
            headerTintColor: "#6366f1",
            headerStyle: { backgroundColor: "#f8f9fa" },
          }}
        />
        <Stack.Screen
          name="match"
          options={{
            headerShown: true,
            headerBackTitle: "Zurück",
            headerTintColor: "#6366f1",
            headerStyle: { backgroundColor: "#f8f9fa" },
          }}
        />
        <Stack.Screen
          name="occlusion"
          options={{
            headerShown: true,
            headerBackTitle: "Zurück",
            headerTintColor: "#6366f1",
            headerStyle: { backgroundColor: "#f8f9fa" },
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
