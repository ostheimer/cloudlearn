/**
 * Archiv der App (#614) — Gegenstück zu apps/web/app/dashboard/archive.
 *
 * „Alt-Schuljahr raus, ohne es zu löschen." Archivierte Decks liegen hier,
 * fallen aus Bibliothek und Fällig-Stapel und kommen auf Knopfdruck zurück.
 *
 * Bewusst NICHT im Profil neben dem Papierkorb: Ein archiviertes Deck ist kein
 * Konto-Thema, sondern Teil der Bibliothek — der Einstieg steht deshalb unter
 * der Deck-Liste.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Layers, RotateCcw } from "lucide-react-native";
import { listDecks, setDeckArchived, type Deck } from "../src/lib/api";
import { buildDeckCountLabel } from "../src/lib/deckCountLabel";
import { useSessionStore } from "../src/store/sessionStore";
import { radius, shadows, spacing, typography, useColors } from "../src/theme";

export default function ArchiveScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const c = useColors();
  const userId = useSessionStore((state) => state.userId);

  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { decks: fetched } = await listDecks(userId, { archived: true });
      setDecks(fetched);
    } catch {
      Alert.alert(t("common.error"), t("archive.loadError"));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const restore = async (deck: Deck) => {
    setBusyId(deck.id);
    try {
      await setDeckArchived(deck.id, false);
      Alert.alert(t("common.success"), t("archive.restored", { title: deck.title }));
      await load();
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : t("archive.restoreError");
      Alert.alert(t("common.error"), message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <ArrowLeft size={22} color={c.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: typography.xxl, fontWeight: typography.bold, color: c.text }}>
            {t("archive.title")}
          </Text>
        </View>

        <Text style={{ color: c.textSecondary, fontSize: typography.sm }}>
          {t("archive.intro")}
        </Text>

        {loading && decks.length === 0 ? (
          <ActivityIndicator size="large" color={c.primary} style={{ marginTop: spacing.xl }} />
        ) : decks.length === 0 ? (
          <View
            style={{
              backgroundColor: c.surface,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: c.border,
              padding: spacing.xl,
              gap: spacing.sm,
              ...shadows.sm,
            }}
          >
            <Text style={{ fontSize: typography.lg, fontWeight: typography.bold, color: c.text }}>
              {t("archive.emptyTitle")}
            </Text>
            <Text style={{ color: c.textSecondary, fontSize: typography.sm }}>
              {t("archive.emptyBody")}
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {decks.map((deck) => (
              <View
                key={deck.id}
                style={{
                  backgroundColor: c.surface,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: c.border,
                  padding: spacing.md,
                  ...shadows.sm,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Layers size={16} color={c.primary} />
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontWeight: typography.bold,
                      color: c.text,
                      fontSize: typography.base,
                    }}
                  >
                    {deck.title}
                  </Text>
                </View>
                <Text style={{ color: c.textSecondary, fontSize: typography.xs, marginTop: 2 }}>
                  {buildDeckCountLabel(deck.cardCount ?? 0, deck.imageCardCount ?? 0, null)}
                </Text>
                <TouchableOpacity
                  onPress={() => void restore(deck)}
                  disabled={busyId === deck.id}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    alignSelf: "flex-start",
                    gap: 6,
                    marginTop: spacing.sm,
                    backgroundColor: c.primary,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 8,
                    opacity: busyId === deck.id ? 0.5 : 1,
                  }}
                >
                  <RotateCcw size={15} color="#fff" />
                  <Text
                    style={{ color: "#fff", fontWeight: typography.bold, fontSize: typography.sm }}
                  >
                    {t("archive.restore")}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
