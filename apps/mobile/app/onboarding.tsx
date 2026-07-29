import { useState } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOnboardingState } from "../src/features/onboarding/onboardingState";
import { useSessionStore } from "../src/store/sessionStore";
import { createDeck, createCard } from "../src/lib/api";
import { useColors, spacing, radius, typography } from "../src/theme";

const SAMPLE_DECK_TITLE_DE = "Erste Karten";
const SAMPLE_DECK_TITLE_EN = "First cards";
const SAMPLE_CARDS: { front: string; back: string }[] = [
  { front: "Hund", back: "dog" },
  { front: "Katze", back: "cat" },
  { front: "Vogel", back: "bird" },
];

export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const colors = useColors();
  const userId = useSessionStore((state) => state.userId);
  const setDueCount = useSessionStore((state) => state.setDueCount);
  const { step, totalSteps, nextStep, completeAndPersist } = useOnboardingState();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    if (!userId) return;
    setError(null);
    setCreating(true);
    try {
      const deckTitle = i18n.language === "de" ? SAMPLE_DECK_TITLE_DE : SAMPLE_DECK_TITLE_EN;
      const { deck } = await createDeck(userId, deckTitle, []);
      for (const card of SAMPLE_CARDS) {
        await createCard(userId, deck.id, {
          front: card.front,
          back: card.back,
          type: "basic",
          difficulty: "medium",
          tags: [],
        });
      }
      setDueCount(SAMPLE_CARDS.length);
      await completeAndPersist();
      router.replace("/(tabs)/learn");
    } catch {
      setError(t("onboarding.error"));
    } finally {
      setCreating(false);
    }
  };

  const isLastStep = step === totalSteps;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          padding: spacing.xl,
          justifyContent: "space-between",
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress dots */}
        <View style={{ flexDirection: "row", gap: 8, alignSelf: "center", marginTop: spacing.md }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i + 1 <= step ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>

        {/* Step content */}
        <View style={{ flex: 1, justifyContent: "center", paddingVertical: spacing.xxl }}>
          {step === 1 && (
            <>
              <Text
                style={{
                  fontSize: typography.xxxl,
                  fontWeight: typography.extrabold,
                  color: colors.text,
                  marginBottom: spacing.lg,
                }}
              >
                {t("onboarding.welcomeTitle")}
              </Text>
              <Text
                style={{
                  fontSize: typography.lg,
                  color: colors.textSecondary,
                  lineHeight: 28,
                }}
              >
                {t("onboarding.welcomeSubtitle")}
              </Text>
            </>
          )}
          {step === 2 && (
            <>
              <Text
                style={{
                  fontSize: typography.xxxl,
                  fontWeight: typography.extrabold,
                  color: colors.text,
                  marginBottom: spacing.lg,
                }}
              >
                {t("onboarding.howTitle")}
              </Text>
              <Text
                style={{
                  fontSize: typography.lg,
                  color: colors.textSecondary,
                  lineHeight: 28,
                }}
              >
                {t("onboarding.howSubtitle")}
              </Text>
            </>
          )}
          {step === 3 && (
            <>
              <Text
                style={{
                  fontSize: typography.xxxl,
                  fontWeight: typography.extrabold,
                  color: colors.text,
                  marginBottom: spacing.lg,
                }}
              >
                {t("onboarding.scanTitle")}
              </Text>
              <Text
                style={{
                  fontSize: typography.lg,
                  color: colors.textSecondary,
                  lineHeight: 28,
                }}
              >
                {t("onboarding.scanSubtitle")}
              </Text>
            </>
          )}
          {step === 4 && (
            <>
              <Text
                style={{
                  fontSize: typography.xxxl,
                  fontWeight: typography.extrabold,
                  color: colors.text,
                  marginBottom: spacing.lg,
                }}
              >
                {t("onboarding.lpTitle")}
              </Text>
              <Text
                style={{
                  fontSize: typography.lg,
                  color: colors.textSecondary,
                  lineHeight: 28,
                }}
              >
                {t("onboarding.lpSubtitle")}
              </Text>
            </>
          )}
          {step === 5 && (
            <>
              <Text
                style={{
                  fontSize: typography.xxxl,
                  fontWeight: typography.extrabold,
                  color: colors.text,
                  marginBottom: spacing.lg,
                }}
              >
                {t("onboarding.startTitle")}
              </Text>
              <Text
                style={{
                  fontSize: typography.lg,
                  color: colors.textSecondary,
                  lineHeight: 28,
                }}
              >
                {t("onboarding.startSubtitle")}
              </Text>
              {error ? (
                <Text
                  style={{
                    marginTop: spacing.lg,
                    fontSize: typography.sm,
                    color: colors.error,
                  }}
                >
                  {error}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {/* Bottom button */}
        <View style={{ paddingBottom: spacing.xl }}>
          {creating ? (
            <View
              style={{
                paddingVertical: spacing.lg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                style={{
                  marginTop: spacing.md,
                  fontSize: typography.base,
                  color: colors.textSecondary,
                }}
              >
                {t("onboarding.creating")}
              </Text>
            </View>
          ) : isLastStep ? (
            <TouchableOpacity
              onPress={handleStart}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: spacing.lg,
                borderRadius: radius.lg,
                alignItems: "center",
              }}
              activeOpacity={0.8}
            >
              <Text
                style={{
                  fontSize: typography.lg,
                  fontWeight: "600",
                  color: "#fff",
                }}
              >
                {t("onboarding.start")}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={nextStep}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: spacing.lg,
                borderRadius: radius.lg,
                alignItems: "center",
              }}
              activeOpacity={0.8}
            >
              <Text
                style={{
                  fontSize: typography.lg,
                  fontWeight: "600",
                  color: "#fff",
                }}
              >
                {t("onboarding.next")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
