import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Download } from "lucide-react-native";
import {
  getSharedDeck,
  importSharedDeck,
  type Card,
  type Deck,
} from "../../../src/lib/api";
import { useSessionStore } from "../../../src/store/sessionStore";
import { useColors, spacing, radius, typography, shadows } from "../../../src/theme";
import { useTranslation } from "react-i18next";

export default function SharedDeckScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const colors = useColors();
  const { t } = useTranslation();
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);

  const [loading, setLoading] = useState(true);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(false);
    getSharedDeck(token)
      .then((res) => {
        setDeck(res.deck);
        setCards(res.cards ?? []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleImport = async () => {
    if (!token || importing) return;
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }
    setImporting(true);
    try {
      const { deck: newDeck } = await importSharedDeck(token);
      router.replace({
        pathname: "/deck/[id]",
        params: { id: newDeck.id, title: newDeck.title },
      });
    } catch {
      Alert.alert(t("common.error"), t("sharedDeck.importError"));
    } finally {
      setImporting(false);
    }
  };

  const cardCount = deck?.cardCount ?? cards.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: t("sharedDeck.title"),
          ...(router.canGoBack()
            ? {}
            : {
                headerLeft: () => (
                  <TouchableOpacity
                    onPress={() => router.replace("/(tabs)")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <ChevronLeft size={24} color={colors.primary} />
                  </TouchableOpacity>
                ),
              }),
        }}
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error || !deck ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.xl,
            gap: spacing.lg,
          }}
        >
          <Text
            style={{
              fontSize: typography.base,
              color: colors.textSecondary,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            {t("sharedDeck.loadError")}
          </Text>
          <TouchableOpacity
            onPress={load}
            style={{
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: typography.semibold }}>
              {t("sharedDeck.retry")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                backgroundColor: colors.primary,
                borderRadius: radius.lg,
                padding: spacing.xl,
                gap: spacing.sm,
                ...shadows.md,
              }}
            >
              <Text
                style={{
                  color: colors.textInverse,
                  fontSize: typography.xs,
                  fontWeight: typography.bold,
                  opacity: 0.85,
                  textTransform: "uppercase",
                }}
              >
                {t("sharedDeck.title")}
              </Text>
              <Text
                style={{
                  color: colors.textInverse,
                  fontSize: typography.xxl,
                  fontWeight: typography.extrabold,
                }}
              >
                {deck.title}
              </Text>
              <Text style={{ color: colors.textInverse, fontSize: typography.base, opacity: 0.9 }}>
                {t("sharedDeck.cardCount", { count: cardCount })}
                {deck.tags?.length ? ` · ${deck.tags.join(", ")}` : ""}
              </Text>
            </View>

            <Text
              style={{
                fontSize: typography.sm,
                color: colors.textSecondary,
                lineHeight: 20,
                paddingHorizontal: spacing.xs,
              }}
            >
              {t("sharedDeck.readOnlyNote")}
            </Text>

            {cards.length === 0 ? (
              <Text
                style={{
                  fontSize: typography.base,
                  color: colors.textSecondary,
                  paddingHorizontal: spacing.xs,
                }}
              >
                {t("sharedDeck.empty")}
              </Text>
            ) : (
              cards.map((card, index) => (
                <View
                  key={index}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: spacing.lg,
                    gap: spacing.xs,
                  }}
                >
                  <Text
                    style={{
                      fontSize: typography.base,
                      fontWeight: typography.semibold,
                      color: colors.text,
                    }}
                  >
                    {card.front}
                  </Text>
                  <Text style={{ fontSize: typography.base, color: colors.textSecondary }}>
                    {card.back}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>

          <View
            style={{
              padding: spacing.lg,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <TouchableOpacity
              onPress={handleImport}
              disabled={importing}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.primary,
                borderRadius: radius.lg,
                padding: spacing.lg,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
                opacity: importing ? 0.7 : 1,
                ...shadows.md,
              }}
            >
              {importing ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Download size={20} color={colors.textInverse} />
              )}
              <Text
                style={{
                  color: colors.textInverse,
                  fontSize: typography.lg,
                  fontWeight: typography.bold,
                }}
              >
                {importing ? t("sharedDeck.importing") : t("sharedDeck.import")}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
