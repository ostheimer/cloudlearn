import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform, View } from "react-native";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { initializeI18n } from "../src/i18n";
import { useSessionStore } from "../src/store/sessionStore";
import { useUsageStore } from "../src/store/usageStore";
import { supabase } from "../src/lib/supabase";
import { useColors, useResolvedThemeMode, useThemeStore } from "../src/theme";
import {
  initializeRevenueCatForUser,
  logoutRevenueCatUser,
} from "../src/features/paywall/revenuecat";
import {
  shouldShowOnboardingForDeckCount,
  useOnboardingState,
} from "../src/features/onboarding/onboardingState";
import {
  listDecks,
  registerPaywallTrigger,
  unregisterPaywallTrigger,
  registerPushToken,
} from "../src/lib/api";
import { getAuthRedirectRouteFromUrl } from "../src/lib/authRedirects";
import {
  consumePendingPasswordRecovery,
  hasHandledPasswordRecoverySession,
  isPasswordRecoverySession,
} from "../src/lib/passwordRecovery";
import { resolveRootRedirect } from "../src/navigation/rootRedirect";
import {
  syncPendingReviewOperations,
  useOfflineQueueStore,
} from "../src/features/sync/offlineQueueStore";
import { useTrackingConsentStore } from "../src/features/ads/trackingConsent";
import { BiometricLockScreen } from "../src/features/security/BiometricLockScreen";
import { useBiometricLockStore } from "../src/features/security/biometricLockStore";
import { MilestoneHost } from "../src/features/milestones/MilestoneHost";

initializeI18n("de");

const MINIMUM_SPLASH_DURATION_MS = 900;

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Native splash may already be managed by the host during hot reloads.
});

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, initialize, session, setSession, signOut, userId } =
    useSessionStore();
  const initializeTheme = useThemeStore((state) => state.initialize);
  const resetUsage = useUsageStore((state) => state.reset);
  const initializeOfflineQueue = useOfflineQueueStore((state) => state.initialize);
  const clearOfflineQueue = useOfflineQueueStore((state) => state.clear);
  const initializeTrackingConsent = useTrackingConsentStore(
    (state) => state.initialize
  );
  const refreshTrackingPermissionStatus = useTrackingConsentStore(
    (state) => state.refreshPermissionStatus
  );
  const offlineQueueHydrated = useOfflineQueueStore(
    (state) => state.queue.hydrated
  );
  const c = useColors();
  const themeMode = useResolvedThemeMode();
  const onboardingCompleted = useOnboardingState((state) => state.completed);
  const loadCompletedFromStorage = useOnboardingState(
    (state) => state.loadCompletedFromStorage
  );
  const completeOnboarding = useOnboardingState((state) => state.complete);
  const completeAndPersistOnboarding = useOnboardingState(
    (state) => state.completeAndPersist
  );
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState === "active"
  );
  const biometricAutoPromptedRef = useRef(false);
  const initializeBiometricLock = useBiometricLockStore(
    (state) => state.initialize
  );
  const biometricHydrated = useBiometricLockStore((state) => state.hydrated);
  const biometricEnabled = useBiometricLockStore((state) => state.enabled);
  const biometricCanUse = useBiometricLockStore((state) => state.canUse);
  const biometricUnlocked = useBiometricLockStore((state) => state.unlocked);
  const biometricAuthenticating = useBiometricLockStore(
    (state) => state.authenticating
  );
  const biometricLabel = useBiometricLockStore((state) => state.label);
  const biometricLastError = useBiometricLockStore((state) => state.lastError);
  const unlockWithBiometrics = useBiometricLockStore((state) => state.unlock);
  const lockBiometricLock = useBiometricLockStore((state) => state.lock);
  const resetBiometricLockAfterSignOut = useBiometricLockStore(
    (state) => state.resetAfterSignOut
  );

  // Initialize auth state on mount
  useEffect(() => {
    void initializeTheme();
  }, [initializeTheme]);

  useEffect(() => {
    void initializeOfflineQueue();
  }, [initializeOfflineQueue]);

  useEffect(() => {
    void initializeTrackingConsent();
  }, [initializeTrackingConsent]);

  useEffect(() => {
    void initializeBiometricLock();
  }, [initializeBiometricLock]);

  useEffect(() => {
    const timerId = setTimeout(() => {
      setMinimumSplashElapsed(true);
    }, MINIMUM_SPLASH_DURATION_MS);

    return () => {
      clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    initialize();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (event === "PASSWORD_RECOVERY") {
          router.replace("/reset-password");
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [initialize, router, setSession]);

  useEffect(() => {
    let mounted = true;

    const handleUrl = async (url: string | null) => {
      if (!url) {
        return;
      }

      const authRoute = getAuthRedirectRouteFromUrl(url);
      if (authRoute) {
        router.replace(authRoute);
        return;
      }

      if (await consumePendingPasswordRecovery()) {
        router.replace("/reset-password");
      }
    };

    void Linking.getInitialURL().then((url) => {
      if (mounted) {
        void handleUrl(url);
      }
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleUrl(url);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [router]);

  // Load onboarding completed from storage when user is authenticated.
  // Fehlt der Geräte-Haken, entscheidet die Deck-Zahl (wie im Web, Laras
  // Entscheidung 27.07.): Bestandskonten bekommen ihn still gesetzt, statt
  // nach jeder Neuinstallation die Einführung samt zweitem Beispiel-Deck
  // durchklicken zu müssen.
  useEffect(() => {
    if (!isAuthenticated) {
      setOnboardingLoaded(false);
      return;
    }
    let cancelled = false;

    (async () => {
      const completed = await loadCompletedFromStorage();
      if (completed || !userId) return;
      try {
        const { decks } = await listDecks(userId);
        if (cancelled) return;
        if (!shouldShowOnboardingForDeckCount(decks.length)) {
          await completeAndPersistOnboarding();
        }
      } catch {
        // Offline/Fehler: Einführung nicht erzwingen — nur für diese
        // Sitzung überspringen (nicht persistiert), der nächste Start
        // prüft erneut.
        if (!cancelled) completeOnboarding();
      }
    })().finally(() => {
      if (!cancelled) {
        setOnboardingLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    userId,
    loadCompletedFromStorage,
    completeAndPersistOnboarding,
    completeOnboarding,
  ]);

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
    if (isLoading) {
      return;
    }

    if (!isAuthenticated || !userId) {
      resetUsage();
      clearOfflineQueue();
      void logoutRevenueCatUser();
      return;
    }

    void initializeRevenueCatForUser(userId).catch(() => {
      // RevenueCat darf den App-Start nicht blockieren.
    });

    // Register Expo push token with our backend for streak notifications
    (async () => {
      try {
        const { default: Notifications } = await import("expo-notifications");
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== "granted") return;
        const token = await Notifications.getExpoPushTokenAsync();
        if (token.data) {
          const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
          await registerPushToken(token.data, platform as "ios" | "android" | "web");
        }
      } catch {
        // Push token registration is best-effort
      }
    })();
  }, [clearOfflineQueue, isAuthenticated, isLoading, resetUsage, userId]);

  // Tapping a friend-streak push opens the Freunde area (Etappe 2). Native-only
  // and gated on auth, so expo-notifications never loads during web bootstrap.
  useEffect(() => {
    if (Platform.OS === "web" || !isAuthenticated || !userId) return;
    let sub: { remove: () => void } | undefined;
    void (async () => {
      try {
        const Notifications = await import("expo-notifications");
        sub = Notifications.addNotificationResponseReceivedListener((response) => {
          const type = response.notification.request.content.data?.type;
          if (typeof type === "string" && type.startsWith("friend_streak")) {
            router.push("/friend-streaks");
          }
        });
      } catch {
        // best-effort — notification routing simply won't work if this fails
      }
    })();
    return () => sub?.remove();
  }, [isAuthenticated, userId, router]);

  useEffect(() => {
    if (!userId || !offlineQueueHydrated) {
      return;
    }

    let active = true;
    const syncPending = async () => {
      if (!active) {
        return;
      }
      try {
        // Rückgabewert bewusst ungenutzt: Hier gibt es keine Oberfläche, die
        // etwas anzeigen könnte. Endgültig abgelehnte Wiederholungen zählt die
        // Warteschlange selbst mit (queue.rejectedCount) — der Lern-Bildschirm
        // zeigt sie beim nächsten Öffnen an, damit nichts still verschwindet
        // (#418).
        await syncPendingReviewOperations(userId);
      } catch {
        // Offline review sync retries on the next tick / foreground event.
      }
    };

    void syncPending();
    const intervalId = setInterval(() => {
      void syncPending();
    }, 30_000);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncPending();
      }
    });
    const handleOnline = () => {
      void syncPending();
    };

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
    }

    return () => {
      active = false;
      clearInterval(intervalId);
      appStateSubscription.remove();
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
      }
    };
  }, [offlineQueueHydrated, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      const isActive = state === "active";
      setIsAppActive(isActive);
      if (!isActive && isAuthenticated && biometricEnabled && biometricCanUse) {
        lockBiometricLock();
      }

      if (state === "active") {
        void refreshTrackingPermissionStatus();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [
    biometricCanUse,
    biometricEnabled,
    isAuthenticated,
    lockBiometricLock,
    refreshTrackingPermissionStatus,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      resetBiometricLockAfterSignOut();
    }
  }, [isAuthenticated, resetBiometricLockAfterSignOut]);

  const appReady =
    !isLoading &&
    (!isAuthenticated || onboardingLoaded) &&
    (!isAuthenticated || biometricHydrated);

  useEffect(() => {
    if (!minimumSplashElapsed) {
      return;
    }

    void SplashScreen.hideAsync().catch(() => {
      // The native splash may already be hidden when the app resumes.
    });
  }, [minimumSplashElapsed]);

  useEffect(() => {
    if (!appReady || !isAuthenticated || segments[0] === "reset-password") {
      return;
    }

    let cancelled = false;
    void (async () => {
      if (
        isPasswordRecoverySession(session) &&
        !(await hasHandledPasswordRecoverySession(session))
      ) {
        if (!cancelled) {
          router.replace("/reset-password");
        }
        return;
      }

      const hasPendingRecovery = await consumePendingPasswordRecovery();
      if (!cancelled && hasPendingRecovery) {
        router.replace("/reset-password");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appReady, isAuthenticated, router, segments, session]);

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
  const firstSegment = segments[0];
  const isBiometricBypassRoute =
    firstSegment === "auth" ||
    firstSegment === "auth-callback" ||
    firstSegment === "reset-password" ||
    firstSegment === "onboarding";
  const shouldShowBiometricLock =
    appReady &&
    isAuthenticated &&
    biometricEnabled &&
    biometricCanUse &&
    !biometricUnlocked &&
    !isBiometricBypassRoute;

  useEffect(() => {
    if (!shouldShowBiometricLock) {
      biometricAutoPromptedRef.current = false;
      return;
    }

    if (!isAppActive || biometricAutoPromptedRef.current) {
      return;
    }

    biometricAutoPromptedRef.current = true;
    const timerId = setTimeout(() => {
      void unlockWithBiometrics();
    }, 300);

    return () => {
      clearTimeout(timerId);
    };
  }, [isAppActive, shouldShowBiometricLock, unlockWithBiometrics]);

  // Loading screen while checking auth or hydrating onboarding state.
  if (!appReady) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: c.background }}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  if (shouldShowBiometricLock) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <BiometricLockScreen
            label={biometricLabel}
            authenticating={biometricAuthenticating}
            lastError={biometricLastError}
            onUnlock={() => {
              void unlockWithBiometrics();
            }}
            onSignOut={() => {
              void signOut();
            }}
          />
        </SafeAreaProvider>
      </GestureHandlerRootView>
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
            <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
            <Stack.Screen name="reset-password" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen
              name="deck-review/[id]"
              options={{
                headerShown: false,
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
              name="cloze"
              options={{
                headerShown: true,
                headerBackTitle: "Zurück",
                headerTintColor,
                headerStyle,
              }}
            />
            <Stack.Screen
              name="test"
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
              name="occlusion-editor"
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
                // Neutral statt "Upgrade": die Seite sehen auch Pro/Lifetime,
                // die nichts upgraden koennen (#607).
                title: "clearn Pro",
              }}
            />
            <Stack.Screen
              name="tracking-preferences"
              options={{
                headerShown: false,
              }}
            />
          </Stack>
          {/* Meilenstein-Boni (#637): eine Anzeige für alle Bildschirme.
              Nach dem Stack, damit Toast und Feier darüber liegen. */}
          <MilestoneHost />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
