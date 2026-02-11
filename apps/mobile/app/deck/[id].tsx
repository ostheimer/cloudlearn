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
  listCardsInDeck,
  createCard,
  updateCard,
  deleteCard,
  type Card,
} from "../../src/lib/api";
import { useSessionStore } from "../../src/store/sessionStore";

// Card editor modal component
function CardEditor({
  visible,
  card,
  onSave,
  onCancel,
}: {
  visible: boolean;
  card: { front: string; back: string; type: string; difficulty: string } | null;
  onSave: (data: { front: string; back: string; type: string; difficulty: string }) => void;
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#e5e7eb",
              backgroundColor: "#fff",
            }}
          >
            <TouchableOpacity onPress={onCancel}>
              <Text style={{ color: "#6b7280", fontSize: 16 }}>Abbrechen</Text>
            </TouchableOpacity>
            <Text style={{ fontWeight: "700", fontSize: 17 }}>
              {card ? "Karte bearbeiten" : "Neue Karte"}
            </Text>
            <TouchableOpacity
              onPress={() => onSave({ front: front.trim(), back: back.trim(), type, difficulty })}
              disabled={!isValid}
            >
              <Text
                style={{
                  color: isValid ? "#6366f1" : "#d1d5db",
                  fontSize: 16,
                  fontWeight: "700",
                }}
              >
                Speichern
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            {/* Front */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontWeight: "600", color: "#374151" }}>Vorderseite (Frage)</Text>
              <TextInput
                value={front}
                onChangeText={setFront}
                placeholder="Frage eingeben..."
                placeholderTextColor="#9ca3af"
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: "#d1d5db",
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  backgroundColor: "#fff",
                  minHeight: 80,
                  textAlignVertical: "top",
                }}
              />
            </View>

            {/* Back */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontWeight: "600", color: "#374151" }}>Rückseite (Antwort)</Text>
              <TextInput
                value={back}
                onChangeText={setBack}
                placeholder="Antwort eingeben..."
                placeholderTextColor="#9ca3af"
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: "#d1d5db",
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  backgroundColor: "#fff",
                  minHeight: 80,
                  textAlignVertical: "top",
                }}
              />
            </View>

            {/* Type selector */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontWeight: "600", color: "#374151" }}>Kartentyp</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["basic", "cloze"] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setType(t)}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: type === t ? "#6366f1" : "#e5e7eb",
                      backgroundColor: type === t ? "#eef2ff" : "#fff",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "600", color: type === t ? "#6366f1" : "#6b7280" }}>
                      {t === "basic" ? "Basic" : "Lückentext"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Difficulty selector */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontWeight: "600", color: "#374151" }}>Schwierigkeit</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["easy", "medium", "hard"] as const).map((d) => {
                  const labels = { easy: "Leicht", medium: "Mittel", hard: "Schwer" };
                  const colors = { easy: "#10b981", medium: "#f59e0b", hard: "#ef4444" };
                  return (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setDifficulty(d)}
                      style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: difficulty === d ? colors[d] : "#e5e7eb",
                        backgroundColor: difficulty === d ? `${colors[d]}15` : "#fff",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: "600",
                          color: difficulty === d ? colors[d] : "#6b7280",
                        }}
                      >
                        {labels[d]}
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
        // Update existing card
        const { card: updated } = await updateCard(editingCard.id, data);
        setCards((prev) => prev.map((c) => (c.id === editingCard.id ? updated : c)));
      } else {
        // Create new card
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
  const difficultyColors: Record<string, string> = {
    easy: "#10b981",
    medium: "#f59e0b",
    hard: "#ef4444",
  };
  const difficultyLabels: Record<string, string> = {
    easy: "Leicht",
    medium: "Mittel",
    hard: "Schwer",
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: deckTitle,
          headerBackTitle: "Decks",
        }}
      />
      <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          {/* Header with card count + add button */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 15, color: "#6b7280" }}>
              {loading ? "Lade..." : `${cards.length} Karte${cards.length !== 1 ? "n" : ""}`}
            </Text>
            <TouchableOpacity
              onPress={handleAddCard}
              style={{
                backgroundColor: "#6366f1",
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>+ Karte</Text>
            </TouchableOpacity>
          </View>

          {/* Card list */}
          {loading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color="#6366f1" />
            </View>
          ) : (
            <ScrollView
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
            >
              {cards.length === 0 ? (
                <View style={{ alignItems: "center", paddingTop: 40, gap: 8 }}>
                  <Text style={{ fontSize: 40 }}>🃏</Text>
                  <Text
                    style={{
                      fontSize: 16,
                      color: "#6b7280",
                      textAlign: "center",
                      lineHeight: 22,
                    }}
                  >
                    Noch keine Karten in diesem Deck.{"\n"}Tippe "+ Karte" oder scanne neuen Inhalt.
                  </Text>
                </View>
              ) : (
                cards.map((card, index) => (
                  <TouchableOpacity
                    key={card.id}
                    onPress={() => handleEditCard(card)}
                    onLongPress={() => handleCardLongPress(card)}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: 12,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: "#e5e7eb",
                    }}
                  >
                    {/* Card number + difficulty badge */}
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: "#9ca3af", fontWeight: "500" }}>
                        #{index + 1} • {card.type === "cloze" ? "Lückentext" : "Basic"}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: difficultyColors[card.difficulty] ?? "#6b7280",
                          fontWeight: "700",
                          textTransform: "uppercase",
                        }}
                      >
                        {difficultyLabels[card.difficulty] ?? card.difficulty}
                      </Text>
                    </View>

                    {/* Front (question) */}
                    <Text
                      style={{ fontWeight: "600", fontSize: 15, color: "#111827" }}
                      numberOfLines={2}
                    >
                      {card.front}
                    </Text>

                    {/* Divider */}
                    <View
                      style={{
                        height: 1,
                        backgroundColor: "#f3f4f6",
                        marginVertical: 8,
                      }}
                    />

                    {/* Back (answer) */}
                    <Text style={{ fontSize: 14, color: "#4b5563" }} numberOfLines={2}>
                      {card.back}
                    </Text>
                  </TouchableOpacity>
                ))
              )}

              {/* Hint */}
              {cards.length > 0 && (
                <Text
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    textAlign: "center",
                    marginTop: 8,
                  }}
                >
                  Tippe auf eine Karte zum Bearbeiten • Halte gedrückt für mehr Optionen
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
