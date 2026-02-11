import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Plus,
  Search,
  Layers,
  ChevronRight,
} from "lucide-react-native";
import { useSessionStore } from "../../src/store/sessionStore";
import {
  listDecks,
  updateDeck,
  deleteDeck,
  createDeck,
  type Deck,
} from "../../src/lib/api";
import { searchDecks } from "../../src/lib/searchDecks";
import { colors, spacing, radius, typography, shadows } from "../../src/theme";

export default function DecksScreen() {
  const router = useRouter();
  const userId = useSessionStore((state) => state.userId);
  const [query, setQuery] = useState("");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDecks = useCallback(async () => {
    if (!userId) return;
    try {
      const { decks: fetched } = await listDecks(userId);
      setDecks(fetched);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDecks();
  };

  const filtered = useMemo(() => searchDecks(decks, query), [decks, query]);

  // --- Actions ---

  const handleCreateDeck = () => {
    Alert.prompt(
      "Neues Deck",
      "Name für das neue Deck:",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Erstellen",
          onPress: async (title: string | undefined) => {
            if (!title?.trim() || !userId) return;
            try {
              await createDeck(userId, title.trim());
              loadDecks();
            } catch {
              Alert.alert("Fehler", "Deck konnte nicht erstellt werden.");
            }
          },
        },
      ],
      "plain-text",
      "",
      "default"
    );
  };

  const handleRenameDeck = (deck: Deck) => {
    Alert.prompt(
      "Deck umbenennen",
      `Neuer Name für "${deck.title}":`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Speichern",
          onPress: async (newTitle: string | undefined) => {
            if (!newTitle?.trim()) return;
            try {
              await updateDeck(deck.id, { title: newTitle.trim() });
              loadDecks();
            } catch {
              Alert.alert("Fehler", "Deck konnte nicht umbenannt werden.");
            }
          },
        },
      ],
      "plain-text",
      deck.title,
      "default"
    );
  };

  const handleDeleteDeck = (deck: Deck) => {
    Alert.alert(
      "Deck löschen?",
      `"${deck.title}" und alle enthaltenen Karten werden gelöscht.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDeck(deck.id);
              setDecks((prev) => prev.filter((d) => d.id !== deck.id));
            } catch {
              Alert.alert("Fehler", "Deck konnte nicht gelöscht werden.");
            }
          },
        },
      ]
    );
  };

  const handleDeckLongPress = (deck: Deck) => {
    Alert.alert(deck.title, "Was möchtest du tun?", [
      { text: "Umbenennen", onPress: () => handleRenameDeck(deck) },
      {
        text: "Löschen",
        style: "destructive",
        onPress: () => handleDeleteDeck(deck),
      },
      { text: "Abbrechen", style: "cancel" },
    ]);
  };

  const handleDeckTap = (deck: Deck) => {
    router.push(`/deck/${deck.id}?title=${encodeURIComponent(deck.title)}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: typography.xxl,
              fontWeight: typography.bold,
              color: colors.text,
            }}
          >
            Decks
          </Text>
          <TouchableOpacity
            onPress={handleCreateDeck}
            activeOpacity={0.8}
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              paddingHorizontal: 14,
              paddingVertical: spacing.sm,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            <Plus size={16} color={colors.textInverse} strokeWidth={3} />
            <Text
              style={{
                color: colors.textInverse,
                fontWeight: typography.bold,
                fontSize: typography.base,
              }}
            >
              Neu
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={{ position: "relative" }}>
          <Search
            size={18}
            color={colors.textTertiary}
            style={{ position: "absolute", left: 14, top: 14, zIndex: 1 }}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Deck suchen..."
            placeholderTextColor={colors.textTertiary}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              paddingLeft: 42,
              paddingRight: spacing.md,
              fontSize: typography.base,
              backgroundColor: colors.surface,
            }}
          />
        </View>

        {/* Deck list */}
        {loading ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={{ gap: spacing.sm + 2, paddingBottom: spacing.xxl }}
          >
            {filtered.length === 0 ? (
              <View
                style={{
                  alignItems: "center",
                  paddingTop: 40,
                  gap: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: colors.surfaceSecondary,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Layers size={28} color={colors.textTertiary} />
                </View>
                <Text
                  style={{
                    fontSize: typography.base,
                    color: colors.textSecondary,
                    textAlign: "center",
                    lineHeight: 22,
                  }}
                >
                  {decks.length === 0
                    ? "Noch keine Decks.\nScanne einen Text, um dein erstes Deck zu erstellen."
                    : "Kein Deck gefunden."}
                </Text>
              </View>
            ) : (
              filtered.map((deck) => (
                <TouchableOpacity
                  key={deck.id}
                  onPress={() => handleDeckTap(deck)}
                  onLongPress={() => handleDeckLongPress(deck)}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    ...shadows.sm,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: typography.semibold,
                        fontSize: typography.base,
                        flex: 1,
                        color: colors.text,
                      }}
                    >
                      {deck.title}
                    </Text>
                    <ChevronRight
                      size={18}
                      color={colors.textTertiary}
                    />
                  </View>
                  {deck.tags.length > 0 && (
                    <View
                      style={{
                        flexDirection: "row",
                        gap: spacing.sm,
                        marginTop: spacing.sm,
                      }}
                    >
                      {deck.tags.map((tag) => (
                        <Text
                          key={tag}
                          style={{
                            fontSize: typography.xs,
                            backgroundColor: colors.surfaceSecondary,
                            paddingHorizontal: spacing.sm,
                            paddingVertical: 2,
                            borderRadius: radius.sm,
                            color: colors.textTertiary,
                            overflow: "hidden",
                          }}
                        >
                          {tag}
                        </Text>
                      ))}
                    </View>
                  )}
                  <Text
                    style={{
                      fontSize: typography.xs,
                      color: colors.textTertiary,
                      marginTop: spacing.sm,
                    }}
                  >
                    {new Date(deck.createdAt).toLocaleDateString("de")}
                  </Text>
                </TouchableOpacity>
              ))
            )}

            {filtered.length > 0 && (
              <Text
                style={{
                  fontSize: typography.xs,
                  color: colors.textTertiary,
                  textAlign: "center",
                  marginTop: spacing.sm,
                }}
              >
                Tippe auf ein Deck für Details · Halte gedrückt zum
                Bearbeiten/Löschen
              </Text>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
