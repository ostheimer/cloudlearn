import React from "react";
import { createRequire } from "node:module";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resources } from "../../i18n/resources";
import { TERMS_URL, PRIVACY_URL } from "../../lib/publicLinks";
import type { UsageState } from "../../store/usageStore";

type MockLink = { accessibilityLabel: string; onPress: () => void };
type MockTouchableProps = React.PropsWithChildren<{
  accessibilityRole?: string;
  accessibilityLabel?: string;
  onPress?: () => void;
}>;
type MockUsageState = Pick<UsageState, "setUsage" | "lpBalance" | "lpCostAiScan">;

// Mobile already ships react-dom for Expo web, but does not depend on its DOM types.
const { renderToStaticMarkup } = createRequire(import.meta.url)("react-dom/server") as {
  renderToStaticMarkup: (element: React.ReactElement) => string;
};

const state = vi.hoisted(() => ({
  language: "de" as "de" | "en",
  links: [] as MockLink[],
  openURL: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("react-native", () => ({
  ActivityIndicator: () => null,
  Alert: { alert: vi.fn() },
  Linking: { openURL: state.openURL },
  ScrollView: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  TouchableOpacity: (props: MockTouchableProps) => {
    if (props.accessibilityRole === "link" && props.accessibilityLabel && props.onPress) {
      state.links.push({ accessibilityLabel: props.accessibilityLabel, onPress: props.onPress });
    }
    return <button aria-label={props.accessibilityLabel}>{props.children}</button>;
  },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
vi.mock("expo-router", () => ({ useRouter: () => ({ back: vi.fn() }), useFocusEffect: () => {} }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({
  t: (key: string) => (resources[state.language].translation as Record<string, string>)[key] ?? key,
}) }));
vi.mock("lucide-react-native", () => ({ CheckCircle2: () => null, Zap: () => null }));
vi.mock("../../theme", () => ({
  useColors: () => ({}), spacing: {}, radius: {}, typography: {}, shadows: {},
}));
vi.mock("../../store/sessionStore", () => ({ useSessionStore: (select: (session: { userId: string | null }) => unknown) => select({ userId: null }) }));
vi.mock("../../store/usageStore", () => ({
  useUsageStore: (select?: (usage: MockUsageState) => unknown) => {
    const usage: MockUsageState = { setUsage: vi.fn(), lpBalance: 10, lpCostAiScan: 10 };
    return select ? select(usage) : usage;
  },
  usageFromBalanceResponse: vi.fn(),
}));
vi.mock("../../lib/api", () => ({ getSubscriptionStatus: vi.fn(), getLpBalance: vi.fn() }));
vi.mock("./revenuecat", () => ({
  getRevenueCatAvailability: vi.fn(), getRevenueCatOfferings: vi.fn(),
  purchaseRevenueCatPackage: vi.fn(), restoreRevenueCatPurchases: vi.fn(),
}));
import PaywallScreen from "../../../app/paywall";

afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
  state.links = [];
  state.openURL.mockClear();
  vi.stubGlobal("React", React);
});

it.each([
  ["de", "Abonnements verlängern sich automatisch", "Store-Konto kündigen", "Lifetime ist ein einmaliger Kauf", "Nutzungsbedingungen", "Datenschutz"],
  ["en", "Subscriptions renew automatically", "cancel in your store account", "Lifetime is a one-time purchase", "Terms of use", "Privacy"],
] as const)("renders legal information and opens both canonical links in %s", async (language, renewal, cancellation, lifetime, termsLabel, privacyLabel) => {
  state.language = language;
  const html = renderToStaticMarkup(<PaywallScreen />);
  expect(html).toContain(renewal);
  expect(html).toContain(cancellation);
  expect(html).toContain(lifetime);
  expect(html).toContain(termsLabel);
  expect(html).toContain(privacyLabel);
  expect(state.links).toHaveLength(2);
  await state.links.find((link) => link.accessibilityLabel === termsLabel)!.onPress();
  await state.links.find((link) => link.accessibilityLabel === privacyLabel)!.onPress();
  expect(state.openURL.mock.calls).toEqual([[TERMS_URL], [PRIVACY_URL]]);
});
