import * as Sentry from "@sentry/react-native";
import type { ComponentType } from "react";
import { APP_RELEASE_VERSION } from "./appInfo";

// Ohne DSN bleibt Absturzmeldung komplett inaktiv — kein Sentry.init, kein
// natives Setup. Erst wenn Andreas EXPO_PUBLIC_SENTRY_DSN als EAS-Secret
// setzt, wird beim nächsten Build etwas verschickt.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

export const crashReportingEnabled = Boolean(dsn);

export function initCrashReporting() {
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    release: APP_RELEASE_VERSION,
    environment: process.env.EXPO_PUBLIC_APP_VARIANT ?? "development",
    // Nur Absturz-/Fehlermeldung — keine Performance-Traces oder Session
    // Replay, die zusätzliche personenbezogene Daten erfassen würden.
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

export function wrapRootLayout<P extends Record<string, unknown>>(
  RootComponent: ComponentType<P>
): ComponentType<P> {
  return dsn ? Sentry.wrap(RootComponent) : RootComponent;
}
