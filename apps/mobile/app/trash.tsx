/**
 * Papierkorb der App (#614) — Gegenstück zu apps/web/app/dashboard/trash.
 *
 * Gleiche Endpunkte, gleiche Wortlaute, gleiche zwei Regeln von Lara:
 *  - Nichts verschwindet von allein (kein Aufräum-Job, keine Frist).
 *  - Selbst gelöschte Karten kommen beim Deck-Restore nicht mit zurück; sie
 *    stehen danach unten unter „Einzelne Karten".
 *
 * Nachfragen laufen über Alert.alert statt über ein eigenes Fenster — so macht
 * es die App überall (siehe Deck löschen in (tabs)/deck/[id].tsx).
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
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react-native";
import {
  emptyTrash,
  getTrash,
  purgeTrashCard,
  purgeTrashDeck,
  restoreTrashCard,
  restoreTrashDeck,
  type TrashCard,
  type TrashDeck,
} from "../src/lib/api";
import { radius, shadows, spacing, typography, useColors } from "../src/theme";

/** „7. Juli" — kurz und ohne Uhrzeit, die hilft hier niemandem. */
function formatDeletedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "long" });
}

export default function TrashScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const c = useColors();

  const [decks, setDecks] = useState<TrashDeck[]>([]);
  const [cards, setCards] = useState<TrashCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const trash = await getTrash();
      setDecks(trash.decks);
      setCards(trash.cards);
    } catch {
      Alert.alert(t("common.error"), t("trash.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Ein Restore kann berechtigt scheitern — Deck-Grenze erreicht, Deck voll,
   * oder das Deck der Karte liegt selbst im Papierkorb. Der Server schickt in
   * allen drei Fällen einen fertigen deutschen Satz (#611), der hier gezeigt
   * wird statt eines allgemeinen „hat nicht funktioniert".
   */
  const run = async (
    id: string,
    action: () => Promise<unknown>,
    successMessage: string,
    fallbackError: string
  ) => {
    setBusyId(id);
    try {
      await action();
      Alert.alert(t("common.success"), successMessage);
      await load();
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : fallbackError;
      Alert.alert(t("common.error"), message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmPurgeDeck = (deck: TrashDeck) => {
    Alert.alert(
      t("trash.purgeDeckTitle"),
      t("trash.purgeDeckBody", {
        title: deck.title,
        cards: t("trash.cardCount", { count: deck.cardCount }),
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("trash.purge"),
          style: "destructive",
          onPress: () =>
            void run(
              deck.id,
              () => purgeTrashDeck(deck.id),
              t("trash.purgedDeck", { title: deck.title }),
              t("trash.purgeError")
            ),
        },
      ]
    );
  };

  const confirmPurgeCard = (card: TrashCard) => {
    Alert.alert(t("trash.purgeCardTitle"), t("trash.purgeCardBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("trash.purge"),
        style: "destructive",
        onPress: () =>
          void run(
            card.id,
            () => purgeTrashCard(card.id),
            t("trash.purgedCard"),
            t("trash.purgeError")
          ),
      },
    ]);
  };

  const confirmEmpty = () => {
    Alert.alert(
      t("trash.emptyTrashTitle"),
      t("trash.emptyTrashBody", {
        decks: t("trash.deckCount", { count: decks.length }),
        cards: t("trash.cardCount", { count: cards.length }),
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("trash.empty"),
          style: "destructive",
          onPress: () =>
            void run("__all__", () => emptyTrash(), t("trash.purgedAll"), t("trash.purgeError")),
        },
      ]
    );
  };

  const total = decks.length + cards.length;

  const actionRow = (
    onRestore: () => void,
    onPurge: () => void,
    disabled: boolean
  ) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.sm }}>
      <TouchableOpacity
        onPress={onRestore}
        disabled={disabled}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: c.primary,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 8,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <RotateCcw size={15} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: typography.bold, fontSize: typography.sm }}>
          {t("trash.restore")}
        </Text>
      </TouchableOpacity>
      {/* „Endgültig löschen" tritt als Textzeile zurück — das passt zu seiner
          Endgültigkeit, und zwei gleich große Knöpfe passen am Handy nicht in
          eine Zeile (gleiche Entscheidung wie im Web). */}
      <TouchableOpacity
        onPress={onPurge}
        disabled={disabled}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, opacity: disabled ? 0.5 : 1 }}
      >
        <Trash2 size={15} color={c.error} />
        <Text style={{ color: c.error, fontWeight: typography.bold, fontSize: typography.sm }}>
          {t("trash.purge")}
        </Text>
      </TouchableOpacity>
    </View>
  );

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
          <Text
            style={{ fontSize: typography.xxl, fontWeight: typography.bold, color: c.text }}
          >
            {t("trash.title")}
          </Text>
        </View>

        <Text style={{ color: c.textSecondary, fontSize: typography.sm }}>
          {t("trash.intro")}
        </Text>

        {loading && total === 0 ? (
          <ActivityIndicator size="large" color={c.primary} style={{ marginTop: spacing.xl }} />
        ) : total === 0 ? (
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
            <Text
              style={{ fontSize: typography.lg, fontWeight: typography.bold, color: c.text }}
            >
              {t("trash.emptyTitle")}
            </Text>
            <Text style={{ color: c.textSecondary, fontSize: typography.sm }}>
              {t("trash.emptyBody")}
            </Text>
          </View>
        ) : (
          <>
            {decks.length > 0 && (
              <View style={{ gap: spacing.sm }}>
                <Text
                  style={{ fontSize: typography.base, fontWeight: typography.bold, color: c.text }}
                >
                  {t("trash.decksHeading", { count: decks.length })}
                </Text>
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
                    <Text
                      numberOfLines={1}
                      style={{ fontWeight: typography.bold, color: c.text, fontSize: typography.base }}
                    >
                      {deck.title}
                    </Text>
                    <Text style={{ color: c.textSecondary, fontSize: typography.xs, marginTop: 2 }}>
                      {t("trash.deckMeta", {
                        cards: t("trash.cardCount", { count: deck.cardCount }),
                        date: formatDeletedAt(deck.deletedAt),
                      })}
                    </Text>
                    {actionRow(
                      () =>
                        void run(
                          deck.id,
                          () => restoreTrashDeck(deck.id),
                          t("trash.restoredDeck", { title: deck.title }),
                          t("trash.restoreError")
                        ),
                      () => confirmPurgeDeck(deck),
                      busyId === deck.id
                    )}
                  </View>
                ))}
              </View>
            )}

            {cards.length > 0 && (
              <View style={{ gap: spacing.sm }}>
                <Text
                  style={{ fontSize: typography.base, fontWeight: typography.bold, color: c.text }}
                >
                  {t("trash.cardsHeading", { count: cards.length })}
                </Text>
                {cards.map((card) => (
                  <View
                    key={card.id}
                    style={{
                      backgroundColor: c.surface,
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: c.border,
                      padding: spacing.md,
                      ...shadows.sm,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{ fontWeight: typography.bold, color: c.text, fontSize: typography.base }}
                    >
                      {card.front}
                    </Text>
                    <Text style={{ color: c.textSecondary, fontSize: typography.xs, marginTop: 2 }}>
                      {t("trash.cardMeta", {
                        deck: card.deckTitle,
                        date: formatDeletedAt(card.deletedAt),
                      })}
                    </Text>
                    {actionRow(
                      () =>
                        void run(
                          card.id,
                          () => restoreTrashCard(card.id),
                          t("trash.restoredCard"),
                          t("trash.restoreError")
                        ),
                      () => confirmPurgeCard(card),
                      busyId === card.id
                    )}
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              onPress={confirmEmpty}
              disabled={busyId !== null}
              activeOpacity={0.7}
              style={{ alignSelf: "center", paddingVertical: spacing.md }}
            >
              <Text
                style={{
                  color: c.error,
                  fontWeight: typography.bold,
                  fontSize: typography.sm,
                  opacity: busyId !== null ? 0.5 : 1,
                }}
              >
                {t("trash.empty")}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
