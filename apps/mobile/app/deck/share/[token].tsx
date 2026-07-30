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
  previewSharedDeckSync,
  syncSharedDeck,
  type Card,
  type Deck,
  type SharedDeckSyncPreview,
} from "../../../src/lib/api";
import { adviceForLimit } from "../../../src/lib/importLimits";
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
  // Habe ich dieses Deck schon? (#614) `null` = noch nicht nachgesehen oder
  // nicht angemeldet. Entscheidet, ob unten ein oder zwei Knoepfe stehen.
  const [sync, setSync] = useState<SharedDeckSyncPreview | null>(null);

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

  /**
   * Nachsehen, ob von diesem Deck schon eine eigene Kopie existiert (#614).
   *
   * Nur angemeldet — die Antwort hängt am Konto. Scheitert die Abfrage, bleibt
   * `sync` auf `null` und der Bildschirm verhält sich wie bisher: ein Knopf,
   * „Übernehmen". Lieber der alte Weg als eine Fehlermeldung, die niemanden
   * weiterbringt.
   */
  useEffect(() => {
    if (!token || !isAuthenticated) return;
    let active = true;
    void previewSharedDeckSync(token)
      .then((res) => {
        if (active) setSync(res);
      })
      .catch(() => {
        if (active) setSync(null);
      });
    return () => {
      active = false;
    };
  }, [token, isAuthenticated]);

  /** „Aktualisieren": nur die fehlenden Karten in die vorhandene Kopie legen. */
  const handleSync = async () => {
    if (!token || importing || !sync?.existingDeck) return;
    setImporting(true);
    try {
      const result = await syncSharedDeck(token);
      Alert.alert(
        t("sharedDeck.syncDoneTitle"),
        result.skipped > 0
          ? t("sharedDeck.syncDoneWithSkipped", {
              added: result.added,
              skipped: result.skipped,
            })
          : t("sharedDeck.syncDone", { added: result.added })
      );
      router.replace({
        pathname: "/deck/[id]",
        params: { id: result.deck.id, title: result.deck.title },
      });
    } catch (e) {
      const advice = adviceForLimit(e);
      Alert.alert(
        advice ? t("sharedDeck.importBlockedTitle") : t("common.error"),
        advice ?? t("sharedDeck.syncError")
      );
    } finally {
      setImporting(false);
    }
  };

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
    } catch (e) {
      // „Bitte versuch es nochmal" war an der Deck-Grenze eine Aufforderung
      // zur Endlosschleife: Der nächste Versuch scheitert genauso. Jetzt steht
      // dort der Grund und der Ausweg, beides vom Server (#611).
      const advice = adviceForLimit(e);
      if (advice) {
        Alert.alert(t("sharedDeck.importBlockedTitle"), advice);
      } else {
        Alert.alert(t("common.error"), t("sharedDeck.importError"));
      }
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
            {/* Habe ich das Deck schon? (#614) Dann steht hier zuerst der
                Hinweis und „Aktualisieren"; „Komplett neu übernehmen" bleibt
                als zweiter Weg darunter — Laras Entwurf. Ein echtes Ersetzen
                gibt es bewusst nicht, das würde den Lernfortschritt wegwerfen. */}
            {sync?.existingDeck && (
              <View style={{ marginBottom: spacing.md, gap: spacing.xs }}>
                <Text
                  style={{
                    fontSize: typography.base,
                    fontWeight: typography.bold,
                    color: colors.text,
                  }}
                >
                  {t("sharedDeck.alreadyHave", { title: sync.existingDeck.title })}
                </Text>
                <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>
                  {sync.newCardCount === 0
                    ? t("sharedDeck.syncNothingNew")
                    : t("sharedDeck.syncNewCards", { count: sync.newCardCount })}
                </Text>
              </View>
            )}

            {sync?.existingDeck && sync.newCardCount > 0 && (
              <TouchableOpacity
                onPress={handleSync}
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
                  marginBottom: spacing.sm,
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
                  {t("sharedDeck.syncCta", { count: sync.newCardCount })}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleImport}
              disabled={importing}
              activeOpacity={0.8}
              style={{
                // Liegt schon eine Kopie vor, ist „nochmal übernehmen" der
                // ZWEITE Weg und tritt entsprechend zurück.
                backgroundColor: sync?.existingDeck ? colors.surface : colors.primary,
                borderWidth: sync?.existingDeck ? 1 : 0,
                borderColor: colors.border,
                borderRadius: radius.lg,
                padding: spacing.lg,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
                opacity: importing ? 0.7 : 1,
                ...(sync?.existingDeck ? {} : shadows.md),
              }}
            >
              {importing && !sync?.existingDeck ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Download
                  size={20}
                  color={sync?.existingDeck ? colors.text : colors.textInverse}
                />
              )}
              <Text
                style={{
                  color: sync?.existingDeck ? colors.text : colors.textInverse,
                  fontSize: typography.lg,
                  fontWeight: typography.bold,
                }}
              >
                {sync?.existingDeck
                  ? t("sharedDeck.importAgain")
                  : importing
                    ? t("sharedDeck.importing")
                    : t("sharedDeck.import")}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
