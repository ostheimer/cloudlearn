import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Plus,
  CreditCard,
  X,
  Check,
  ChevronRight,
  Star,
} from "lucide-react-native";
import {
  listCardsInDeck,
  createCard,
  updateCard,
  deleteCard,
  type Card,
} from "../../src/lib/api";
import { useSessionStore } from "../../src/store/sessionStore";
import { colors, spacing, radius, typography, shadows } from "../../src/theme";

// Card editor modal component
function CardEditor({
  visible,
  card,
  onSave,
  onCancel,
}: {
  visible: boolean;
  card: {
    front: string;
    back: string;
    type: string;
    difficulty: string;
  } | null;
  onSave: (data: {
    front: string;
    back: string;
    type: string;
    difficulty: string;
  }) => void;
  onCancel: () => void;
}) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [type, setType] = useState("basic");
  const [difficulty, setDifficulty] = useState("medium");

  useEffect(() => {
    if (card) {
      setFront(card.front);
      setBack(card.back);
      setType(card.type);
      setDifficulty(card.difficulty);
    } else {
      setFront("");
      setBack("");
      setType("basic");
      setDifficulty("medium");
    }
  }, [card, visible]);

  const isValid = front.trim().length > 0 && back.trim().length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <TouchableOpacity
              onPress={onCancel}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <X size={18} color={colors.textSecondary} />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.base,
                }}
              >
                Abbrechen
              </Text>
            </TouchableOpacity>
            <Text
              style={{
                fontWeight: typography.bold,
                fontSize: typography.lg,
                color: colors.text,
              }}
            >
              {card ? "Karte bearbeiten" : "Neue Karte"}
            </Text>
            <TouchableOpacity
              onPress={() =>
                onSave({
                  front: front.trim(),
                  back: back.trim(),
                  type,
                  difficulty,
                })
              }
              disabled={!isValid}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <Check
                size={18}
                color={isValid ? colors.primary : colors.textTertiary}
              />
              <Text
                style={{
                  color: isValid ? colors.primary : colors.textTertiary,
                  fontSize: typography.base,
                  fontWeight: typography.bold,
                }}
              >
                Speichern
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          >
            {/* Front */}
            <View style={{ gap: spacing.sm }}>
              <Text
                style={{
                  fontWeight: typography.semibold,
                  color: colors.textSecondary,
                  fontSize: typography.sm,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Vorderseite (Frage)
              </Text>
              <TextInput
                value={front}
                onChangeText={setFront}
                placeholder="Frage eingeben..."
                placeholderTextColor={colors.textTertiary}
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: 14,
                  fontSize: typography.base,
                  backgroundColor: colors.surface,
                  minHeight: 80,
                  textAlignVertical: "top",
                  color: colors.text,
                }}
              />
            </View>

            {/* Back */}
            <View style={{ gap: spacing.sm }}>
              <Text
                style={{
                  fontWeight: typography.semibold,
                  color: colors.textSecondary,
                  fontSize: typography.sm,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Rückseite (Antwort)
              </Text>
              <TextInput
                value={back}
                onChangeText={setBack}
                placeholder="Antwort eingeben..."
                placeholderTextColor={colors.textTertiary}
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: 14,
                  fontSize: typography.base,
                  backgroundColor: colors.surface,
                  minHeight: 80,
                  textAlignVertical: "top",
                  color: colors.text,
                }}
              />
            </View>

            {/* Type selector */}
            <View style={{ gap: spacing.sm }}>
              <Text
                style={{
                  fontWeight: typography.semibold,
                  color: colors.textSecondary,
                  fontSize: typography.sm,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Kartentyp
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {(["basic", "cloze"] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setType(t)}
                    activeOpacity={0.8}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.md,
                      borderRadius: radius.md,
                      borderWidth: 2,
                      borderColor:
                        type === t ? colors.primary : colors.border,
                      backgroundColor:
                        type === t ? colors.primaryLight : colors.surface,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: typography.semibold,
                        color:
                          type === t
                            ? colors.primary
                            : colors.textSecondary,
                      }}
                    >
                      {t === "basic" ? "Basic" : "Lückentext"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Difficulty selector */}
            <View style={{ gap: spacing.sm }}>
              <Text
                style={{
                  fontWeight: typography.semibold,
                  color: colors.textSecondary,
                  fontSize: typography.sm,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Schwierigkeit
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {(["easy", "medium", "hard"] as const).map((d) => {
                  const meta = {
                    easy: {
                      label: "Leicht",
                      color: colors.success,
                      bg: colors.successLight,
                    },
                    medium: {
                      label: "Mittel",
                      color: colors.warning,
                      bg: colors.warningLight,
                    },
                    hard: {
                      label: "Schwer",
                      color: colors.error,
                      bg: colors.errorLight,
                    },
                  };
                  const { label, color, bg } = meta[d];
                  return (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setDifficulty(d)}
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        paddingVertical: spacing.md,
                        borderRadius: radius.md,
                        borderWidth: 2,
                        borderColor:
                          difficulty === d ? color : colors.border,
                        backgroundColor:
                          difficulty === d ? bg : colors.surface,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: typography.semibold,
                          color:
                            difficulty === d
                              ? color
                              : colors.textSecondary,
                        }}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function DeckDetailScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title: string }>();
  const router = useRouter();
  const userId = useSessionStore((state) => state.userId);

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Card editor state
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [saving, setSaving] = useState(false);

  const deckId = id ?? "";
  const deckTitle = title ?? "Deck";

  const loadCards = useCallback(async () => {
    if (!deckId) return;
    try {
      const { cards: fetched } = await listCardsInDeck(deckId);
      setCards(fetched);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deckId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCards();
  };

  // --- Actions ---

  const handleAddCard = () => {
    setEditingCard(null);
    setEditorVisible(true);
  };

  const handleEditCard = (card: Card) => {
    setEditingCard(card);
    setEditorVisible(true);
  };

  const handleDeleteCard = (card: Card) => {
    Alert.alert(
      "Karte löschen?",
      `"${card.front.slice(0, 50)}${card.front.length > 50 ? "..." : ""}" wird dauerhaft gelöscht.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCard(card.id);
              setCards((prev) => prev.filter((c) => c.id !== card.id));
            } catch {
              Alert.alert("Fehler", "Karte konnte nicht gelöscht werden.");
            }
          },
        },
      ]
    );
  };

  const handleToggleStar = async (card: Card) => {
    const newVal = !card.starred;
    // Optimistic update
    setCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, starred: newVal } : c))
    );
    try {
      await updateCard(card.id, { starred: newVal });
    } catch {
      // Revert on error
      setCards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, starred: !newVal } : c))
      );
    }
  };

  const handleCardLongPress = (card: Card) => {
    Alert.alert("Karte", "Was möchtest du tun?", [
      { text: "Bearbeiten", onPress: () => handleEditCard(card) },
      {
        text: "Löschen",
        style: "destructive",
        onPress: () => handleDeleteCard(card),
      },
      { text: "Abbrechen", style: "cancel" },
    ]);
  };

  const handleSaveCard = async (data: {
    front: string;
    back: string;
    type: string;
    difficulty: string;
  }) => {
    if (!userId || !deckId) return;
    setSaving(true);
    try {
      if (editingCard) {
        const { card: updated } = await updateCard(editingCard.id, data);
        setCards((prev) =>
          prev.map((c) => (c.id === editingCard.id ? updated : c))
        );
      } else {
        const { card: created } = await createCard(userId, deckId, {
          ...data,
          tags: [],
        });
        setCards((prev) => [...prev, created]);
      }
      setEditorVisible(false);
      setEditingCard(null);
    } catch {
      Alert.alert("Fehler", "Karte konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  // Difficulty badge colors
  const difficultyMeta: Record<
    string,
    { color: string; label: string }
  > = {
    easy: { color: colors.success, label: "Leicht" },
    medium: { color: colors.warning, label: "Mittel" },
    hard: { color: colors.error, label: "Schwer" },
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: deckTitle,
          headerBackTitle: "Decks",
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <SafeAreaView
        edges={["bottom"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
          {/* Header with card count + add button */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: typography.base,
                color: colors.textSecondary,
                fontWeight: typography.medium,
              }}
            >
              {loading
                ? "Lade..."
                : `${cards.length} Karte${cards.length !== 1 ? "n" : ""}`}
            </Text>
            <TouchableOpacity
              onPress={handleAddCard}
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
              <Plus
                size={16}
                color={colors.textInverse}
                strokeWidth={3}
              />
              <Text
                style={{
                  color: colors.textInverse,
                  fontWeight: typography.bold,
                  fontSize: typography.base,
                }}
              >
                Karte
              </Text>
            </TouchableOpacity>
          </View>

          {/* Card list */}
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
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                />
              }
              contentContainerStyle={{
                gap: spacing.sm + 2,
                paddingBottom: spacing.xxl,
              }}
            >
              {cards.length === 0 ? (
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
                    <CreditCard size={28} color={colors.textTertiary} />
                  </View>
                  <Text
                    style={{
                      fontSize: typography.base,
                      color: colors.textSecondary,
                      textAlign: "center",
                      lineHeight: 22,
                    }}
                  >
                    Noch keine Karten in diesem Deck.{"\n"}Tippe "+ Karte"
                    oder scanne neuen Inhalt.
                  </Text>
                </View>
              ) : (
                cards.map((card, idx) => {
                  const meta = difficultyMeta[card.difficulty] ?? {
                    color: colors.textSecondary,
                    label: card.difficulty,
                  };
                  return (
                    <TouchableOpacity
                      key={card.id}
                      onPress={() => handleEditCard(card)}
                      onLongPress={() => handleCardLongPress(card)}
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
                      {/* Card number + star + difficulty badge */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: spacing.sm,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: typography.xs,
                            color: colors.textTertiary,
                            fontWeight: typography.medium,
                          }}
                        >
                          #{idx + 1} ·{" "}
                          {card.type === "cloze"
                            ? "Lückentext"
                            : "Basic"}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                          <TouchableOpacity
                            onPress={() => handleToggleStar(card)}
                            activeOpacity={0.6}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Star
                              size={16}
                              color={card.starred ? colors.warning : colors.textTertiary}
                              fill={card.starred ? colors.warning : "none"}
                            />
                          </TouchableOpacity>
                          <Text
                            style={{
                              fontSize: typography.xs,
                              color: meta.color,
                              fontWeight: typography.bold,
                              textTransform: "uppercase",
                            }}
                          >
                            {meta.label}
                          </Text>
                        </View>
                      </View>

                      {/* Front (question) */}
                      <Text
                        style={{
                          fontWeight: typography.semibold,
                          fontSize: typography.base,
                          color: colors.text,
                        }}
                        numberOfLines={2}
                      >
                        {card.front}
                      </Text>

                      {/* Divider */}
                      <View
                        style={{
                          height: 1,
                          backgroundColor: colors.borderLight,
                          marginVertical: spacing.sm,
                        }}
                      />

                      {/* Back (answer) */}
                      <Text
                        style={{
                          fontSize: typography.sm + 1,
                          color: colors.textSecondary,
                        }}
                        numberOfLines={2}
                      >
                        {card.back}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}

              {cards.length > 0 && (
                <Text
                  style={{
                    fontSize: typography.xs,
                    color: colors.textTertiary,
                    textAlign: "center",
                    marginTop: spacing.sm,
                  }}
                >
                  Tippe auf eine Karte zum Bearbeiten · Halte gedrückt
                  für mehr Optionen
                </Text>
              )}
            </ScrollView>
          )}
        </View>

        {/* Card editor modal */}
        <CardEditor
          visible={editorVisible}
          card={
            editingCard
              ? {
                  front: editingCard.front,
                  back: editingCard.back,
                  type: editingCard.type,
                  difficulty: editingCard.difficulty,
                }
              : null
          }
          onSave={handleSaveCard}
          onCancel={() => {
            setEditorVisible(false);
            setEditingCard(null);
          }}
        />
      </SafeAreaView>
    </>
  );
}
