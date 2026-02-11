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
import { useSessionStore } from "../../src/store/sessionStore";
import { listDecks, updateDeck, deleteDeck, createDeck, type Deck } from "../../src/lib/api";
import { searchDecks } from "../../src/lib/searchDecks";

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
          onPress: async (title) => {
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
          onPress: async (newTitle) => {
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 22, fontWeight: "700" }}>Decks</Text>
          <TouchableOpacity
            onPress={handleCreateDeck}
            style={{
              backgroundColor: "#6366f1",
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>+ Neu</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Deck suchen..."
          placeholderTextColor="#9ca3af"
          style={{
            borderWidth: 1,
            borderColor: "#d1d5db",
            borderRadius: 12,
            padding: 12,
            fontSize: 16,
            backgroundColor: "#fff",
          }}
        />

        {/* Deck list */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
        ) : (
          <ScrollView
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          >
            {filtered.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 40, gap: 8 }}>
                <Text style={{ fontSize: 40 }}>📚</Text>
                <Text style={{ fontSize: 16, color: "#6b7280", textAlign: "center" }}>
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
                    backgroundColor: "#fff",
                    borderRadius: 12,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontWeight: "600", fontSize: 16, flex: 1 }}>{deck.title}</Text>
                    <Text style={{ color: "#9ca3af", fontSize: 20 }}>›</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                    {deck.tags.map((tag) => (
                      <Text
                        key={tag}
                        style={{
                          fontSize: 12,
                          backgroundColor: "#f3f4f6",
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 6,
                          color: "#6b7280",
                        }}
                      >
                        {tag}
                      </Text>
                    ))}
                  </View>
                  <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
                    {new Date(deck.createdAt).toLocaleDateString("de")}
                  </Text>
                </TouchableOpacity>
              ))
            )}

            {/* Hint */}
            {filtered.length > 0 && (
              <Text style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 8 }}>
                Tippe auf ein Deck für Details • Halte gedrückt zum Bearbeiten/Löschen
              </Text>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
